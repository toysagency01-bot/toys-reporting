import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {fixture,testWorker,request} from './fixture.mjs';
import {saveAdsSnapshot,readAdsSnapshot,scopeKey} from '../imports/ads-store.js';
import {scheduledAds} from '../imports/scheduled-ads.js';
import {advertisingModel} from '../unified/model.js';
import {refreshUsdUah} from '../imports/fx.js';
import {addDecimal} from '../native/google-receiver.js';
const dir=mkdtempSync(join(tmpdir(),'direct-ads-'));
await build({stdin:{contents:readFileSync('runtime/backend.js','utf8')+'\nexport {normalizeAdsHierarchy,integrationScope,parseProfkit,PROFIT_BOOK,METRIC_NAMES};',resolveDir:resolve('runtime')},outfile:join(dir,'runtime.mjs'),bundle:true,format:'esm',platform:'node',plugins:[{name:'cf',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cf',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export class WorkerEntrypoint {}'}));}}]});
const rt=await import(pathToFileURL(join(dir,'runtime.mjs')));rmSync(dir,{force:true,recursive:true});
const worker=await testWorker();
test('only registered draft onboarding imports run, with verified account timezone before the first request',async()=>{
 const {env,db}=setup();try{
  env.DIRECT_ADS_IMPORT_ENABLED='true';
  for(const [id,slug]of [['bs','bs-clinic-a5b4'],['later','taycher-not-approved']]){
   db.prepare("INSERT INTO projects(id,organization_id,slug,name,project_type,status,currency,timezone) VALUES(?,'org_toys_agency',?,'Synthetic','leadgen','draft','CZK','Asia/Tbilisi')").run(id,slug);
   db.prepare("INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES(?,?,'meta_ads','123','active',?)").run(id,id,JSON.stringify({onboardingImport:true,verifyAccountMetadata:true,expectedCurrency:'CZK'}));
  }
  let metadataCalls=0,imports=0,time=Date.parse('2026-10-13T06:00:00Z');
  const adapter=async({integration})=>{imports++;assert.equal(integration.timezone,'Europe/Prague');return {provider:'meta_ads',accountId:'123',timezone:integration.timezone,currency:'CZK',coverage:'complete',dailyMetrics:[],campaigns:[]};};
  adapter.accountMetadata=async row=>{metadataCalls++;assert.equal(row.slug,'bs-clinic-a5b4');return {accountTimezone:'Europe/Prague',expectedCurrency:'CZK'};};
  const deps={now:()=>time,makeScope:rt.integrationScope,normalize:rt.normalizeAdsHierarchy,metrics:rt.METRIC_NAMES,metaAdapter:adapter};
  assert.equal((await scheduledAds(env,deps))[0].status,'success');
  time+=20*60000;assert.equal((await scheduledAds(env,deps))[0].status,'success');
  assert.equal(metadataCalls,1);assert.equal(imports,2);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ads_import_status WHERE project_id='later'").get().n,0);
  db.prepare("UPDATE integrations SET config_json=? WHERE id='bs'").run(JSON.stringify({onboardingImport:true,verifyAccountMetadata:true,expectedCurrency:'CZK'}));
  time+=20*60000;adapter.accountMetadata=async()=>{throw Object.assign(Error('Mismatch'),{code:'account_scope_mismatch'});};
  assert.equal((await scheduledAds(env,deps))[0].error,'account_scope_mismatch');assert.equal(imports,2);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ads_daily_snapshots WHERE project_id='bs'").get().n,30);
 }finally{db.close();}
});
const setup=()=>{const f=fixture();f.db.exec(readFileSync('migrations/0017_direct_ads.sql','utf8'));return f;};
const scope={organizationId:'org_toys_agency',projectId:'prj_housevip_cxp7',projectSlug:'housevip-cxp7',integrationId:'direct-meta',provider:'meta_ads',accountId:'123',timezone:'UTC',currency:'IDR',metrics:rt.METRIC_NAMES};
test('independent reconciliation mismatch is recorded without silently replacing valid provider data',async()=>{
 const {env,db}=setup();try{
  env.DIRECT_ADS_IMPORT_ENABLED='true';
  db.exec(`INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES('direct-meta','prj_housevip_cxp7','meta_ads','123','active','{"timezone":"UTC","currency":"IDR"}')`);
  const audit={schemaVersion:'meta-account-reconciliation/1',status:'mismatch',comparedDays:29,matchedDays:28};
  const result=await scheduledAds(env,{now:()=>Date.parse('2026-10-13T12:00:00Z'),makeScope:rt.integrationScope,normalize:rt.normalizeAdsHierarchy,metrics:rt.METRIC_NAMES,metaAdapter:async()=>({provider:'meta_ads',accountId:'123',timezone:'UTC',currency:'IDR',coverage:'complete',dailyMetrics:[],campaigns:[],accountReconciliation:audit})});
  assert.equal(result[0].status,'success');
  const log=db.prepare("SELECT status,details_json FROM sync_runs WHERE job_type='meta-account-reconciliation'").get();
  assert.equal(log.status,'warning');assert.deepEqual(JSON.parse(log.details_json),audit);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ads_daily_snapshots').get().n,30);
 }finally{db.close();}
});
test('Google account totals preserve exact currency and fractional conversions',()=>{
 assert.equal(addDecimal('21.23','8.404938'),'29.634938');assert.equal(addDecimal('0.1','0.2'),'0.3');assert.equal(addDecimal('9007199254740993','1'),'9007199254740994');
});
test('Meta import diagnostics retain numeric provider codes without leaking raw errors or changing retry cadence',async()=>{
 const {env,db}=setup();try{
  env.DIRECT_ADS_IMPORT_ENABLED='true';
  db.exec(`INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES('direct-meta','prj_housevip_cxp7','meta_ads','123','active','{"timezone":"UTC","currency":"IDR"}')`);
  let calls=0,time=Date.parse('2026-10-13T12:00:00Z');
  const error=Object.assign(new Error('sensitive token and provider URL'),{code:'provider_unauthorized',providerCode:200,providerSubcode:1815694,accessToken:'sensitive'});
  const deps={now:()=>time,makeScope:rt.integrationScope,normalize:rt.normalizeAdsHierarchy,metrics:rt.METRIC_NAMES,metaAdapter:async()=>{calls++;throw error;}};
  assert.equal((await scheduledAds(env,deps))[0].error,'provider_unauthorized');
  const log=db.prepare("SELECT * FROM sync_runs WHERE job_type='meta-import-diagnostic'").get();
  assert.deepEqual(JSON.parse(log.details_json),{schemaVersion:'meta-import-error/1',integrationId:'direct-meta',accountId:'123',providerCode:200,providerSubcode:1815694});
  assert.equal(log.message,'provider_unauthorized');assert.ok(!JSON.stringify(log).includes('sensitive'));
  assert.equal(db.prepare('SELECT next_attempt_at FROM ads_import_status').get().next_attempt_at,'2026-10-13T12:20:00.000Z');
  assert.equal((await scheduledAds(env,deps))[0].status,'not_due');assert.equal(calls,1);
  time+=20*60000;error.providerCode='sensitive';error.providerSubcode={token:'sensitive'};
  assert.equal((await scheduledAds(env,deps))[0].error,'provider_unauthorized');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sync_runs WHERE job_type='meta-import-diagnostic'").get().n,1);
 }finally{db.close();}
});
function payload(at='2026-10-12T18:00:00Z',spend='20'){
 const day={date:'2026-10-12',metrics:{impressions:'100',clicks:'4',spend,conversions:'2',conversionValue:'0'}};
 return {...rt.normalizeAdsHierarchy({provider:'meta_ads',accountId:'123',timezone:'UTC',currency:'IDR',coverage:'complete',dailyMetrics:[day],campaigns:[{id:'1',name:'Synthetic',dailyMetrics:[day],adsets:[]}]},{...scope,from:'2026-10-11',to:'2026-10-12'}),fetchedAt:at};
}
test('daily store retains empty days, merges periods, blocks scope drift and refuses older overwrites',async()=>{
 const{env,db}=setup();try{
  await saveAdsSnapshot(env.TOYS_DB,scope,payload());await saveAdsSnapshot(env.TOYS_DB,scope,payload('2026-10-12T17:00:00Z','5'));
  const p=await readAdsSnapshot(env.TOYS_DB,scope,'2026-10-10','2026-10-12',Date.parse('2026-10-12T18:10:00Z'));
  assert.equal(p.coverage,'partial');assert.deepEqual(p.coveredDates,['2026-10-11','2026-10-12']);assert.equal(p.hierarchy.children[0].dailyMetrics[0].metrics.spend.value,'20');
  assert.equal(await readAdsSnapshot(env.TOYS_DB,{...scope,accountId:'999'},'2026-10-11','2026-10-12'),null);
  await assert.rejects(saveAdsSnapshot(env.TOYS_DB,{...scope,accountId:'999'},payload()),{code:'snapshot_scope_mismatch'});
  const rows=advertisingModel({facts:{rows:[{date:'2026-10-10',campaign:{label:'Archived'},metrics:[{metricCode:'ads.spend',value:'7',state:'observed',currency:'IDR'}]},{date:'2026-10-11',campaign:{label:'Old'},metrics:[{metricCode:'ads.spend',value:'9',state:'observed',currency:'IDR'}]}]}},{providers:[p]},{from:'2026-10-10',to:'2026-10-12'});
  assert.deepEqual(rows.map(r=>[r.date,r.spend]),[['2026-10-10',7],['2026-10-12',20]]);
 }finally{db.close();}
});
test('a failed database transaction cannot publish part of an import',async()=>{
 const{env,db}=setup();try{
  db.exec("CREATE TRIGGER fail_second BEFORE INSERT ON ads_daily_snapshots WHEN NEW.local_date='2026-10-12' BEGIN SELECT RAISE(ABORT,'synthetic quota error'); END");
  await assert.rejects(saveAdsSnapshot(env.TOYS_DB,scope,payload()),/synthetic quota/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ads_daily_snapshots').get().n,0);
 }finally{db.close();}
});
test('scheduled imports recover only at the next slot and dashboard reads never contact providers',async()=>{
 const{env,db}=setup();const original=globalThis.fetch;try{
  env.DIRECT_ADS_IMPORT_ENABLED='true';env.DIRECT_ADS_READ_ENABLED='true';
  db.exec(`INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES('direct-meta','prj_housevip_cxp7','meta_ads','123','active','{"timezone":"UTC","currency":"IDR"}')`);
  let time=Date.parse('2026-10-12T18:00:00Z'),calls=0,fail=true;
  const deps={now:()=>time,makeScope:rt.integrationScope,normalize:rt.normalizeAdsHierarchy,metrics:rt.METRIC_NAMES,metaAdapter:async()=>{calls++;if(fail)throw Object.assign(new Error('Down'),{code:'provider_timeout'});return {provider:'meta_ads',accountId:'123',timezone:'UTC',currency:'IDR',coverage:'complete',dailyMetrics:[],campaigns:[]};}};
  assert.equal((await scheduledAds(env,deps))[0].error,'provider_timeout');
  assert.equal((await scheduledAds(env,deps))[0].status,'not_due');assert.equal(calls,1);
  fail=false;time+=121000;assert.deepEqual(await scheduledAds(env,deps),[]);assert.equal(calls,1);time=Date.parse('2026-10-12T18:20:00Z');assert.equal((await scheduledAds(env,deps))[0].status,'success');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ads_daily_snapshots').get().n,30);
  let providerReads=0;globalThis.fetch=()=>{providerReads++;throw new Error('A dashboard must not call a provider');};
  const r=await worker.fetch(request('/api/v2/projects/housevip-cxp7/ads-summary?from=2026-10-11&to=2026-10-12'),env);
  assert.equal(r.status,200);const data=await r.json();assert.equal(data.providers[0].coverage,'complete');assert.ok(data.providers[0].hierarchy);
  // Fresh, historical and missing ranges all stay in the database, including repeated reads.
  for(const range of ['from=2026-10-11&to=2026-10-12','from=2026-01-01&to=2026-01-02'])for(const endpoint of ['ads-summary','content-project/ads/hierarchy','top-creatives','campaign-browser'])for(let repeat=0;repeat<2;repeat++){
   const response=await worker.fetch(request('/api/v2/projects/housevip-cxp7/'+endpoint+'?'+range),env);assert.equal(response.status,200,endpoint);
  }
  assert.equal(providerReads,0);
  const status=db.prepare('SELECT state,failure_count FROM ads_import_status').get();assert.equal(status.state,'success');assert.equal(status.failure_count,0);
 }finally{globalThis.fetch=original;db.close();}
});
test('business-only PROFKIT parsing needs no advertising or content tables and still validates lead totals',()=>{
 const make=(sheet,values)=>({spreadsheet_id:rt.PROFIT_BOOK,sheet,values});
 const input={delivery_provider:'public_gviz',tables:{profkit_sales:make('InstashopSales',[['date','qualified_inquiries','unqualified_inquiries','direct_inquiries','sales','revenue_uah'],['2026-10-12',2,1,3,1,100]]),profkit_fx:make('FxRates',[['date','usd_uah','source_url'],['2026-10-12',41,'https://bank.gov.ua']])}};
 const result=rt.parseProfkit(input,{businessOnly:true});assert.deepEqual(result.streams.map(s=>s.key),['profkit_sales','profkit_fx']);
 input.tables.profkit_sales.values[1][3]=10;assert.throws(()=>rt.parseProfkit(input,{businessOnly:true}),{code:'cross_stream_mismatch'});
});
test('night imports run hourly, skip D1 between runs and retry failures only at the next hour',async()=>{
 const{env,db}=setup();try{
  env.DIRECT_ADS_IMPORT_ENABLED='true';
  db.exec(`INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES('direct-meta','prj_housevip_cxp7','meta_ads','123','active','{"timezone":"UTC","currency":"IDR"}')`);
  let time=Date.parse('2026-10-12T20:00:54Z'),calls=0,fail=false;
  const deps={now:()=>time,makeScope:rt.integrationScope,normalize:rt.normalizeAdsHierarchy,metrics:rt.METRIC_NAMES,metaAdapter:async()=>{calls++;if(fail)throw Object.assign(new Error('Down'),{code:'provider_timeout'});return {provider:'meta_ads',accountId:'123',timezone:'UTC',currency:'IDR',coverage:'complete',dailyMetrics:[],campaigns:[]};}};
  assert.equal((await scheduledAds(env,deps))[0].status,'success');
  assert.equal(db.prepare('SELECT next_attempt_at FROM ads_import_status').get().next_attempt_at,'2026-10-12T21:00:00.000Z');
  const noDB={...env,TOYS_DB:{prepare(){throw new Error('No D1 access between night imports');}}};
  for(const t of ['20:02','20:20','20:40','20:58']){time=Date.parse('2026-10-12T'+t+':54Z');assert.deepEqual(await scheduledAds(noDB,deps),[]);}
  assert.equal(calls,1);
  const stored=await readAdsSnapshot(env.TOYS_DB,scope,'2026-10-12','2026-10-12',time);
  assert.equal(stored.freshness,'fresh');
  time=Date.parse('2026-10-12T21:00:54Z');fail=true;
  assert.equal((await scheduledAds(env,deps))[0].error,'provider_timeout');
  assert.equal(db.prepare('SELECT next_attempt_at FROM ads_import_status').get().next_attempt_at,'2026-10-12T22:00:00.000Z');
  fail=false;time=Date.parse('2026-10-12T22:01:03Z');
  // A delayed cron still belongs to the scheduled :00 slot.
  assert.equal((await scheduledAds(env,{...deps,scheduledAt:Date.parse('2026-10-12T22:00:00Z')}))[0].status,'success');
  assert.equal(calls,3);
 }finally{db.close();}
});
test('FX import accepts only the official rate for the requested date and preserves existing rates',async()=>{
 const{env,db}=setup();try{
  const day='2026-10-12';let calls=0;
  await assert.rejects(refreshUsdUah(env,{now:new Date(day+'T18:00:00Z'),fetchImpl:async()=>Response.json([{cc:'USD',rate:41,exchangedate:'11.10.2026'}])}),/invalid/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM exchange_rates WHERE base_currency='USD' AND quote_currency='UAH'").get().n,0);
  await refreshUsdUah(env,{now:new Date(day+'T18:00:00Z'),fetchImpl:async url=>{calls++;const d=new URL(url).searchParams.get('date');return Response.json([{cc:'USD',rate:41,exchangedate:d.slice(6,8)+'.'+d.slice(4,6)+'.'+d.slice(0,4)}]);}});
  assert.equal(calls,5);assert.equal(db.prepare("SELECT rate FROM exchange_rates WHERE rate_date=? AND base_currency='USD' AND quote_currency='UAH'").get(day).rate,41);
 }finally{db.close();}
});
