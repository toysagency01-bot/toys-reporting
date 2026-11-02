import {build} from 'esbuild';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
// Read-only reconciliation of archived and replacement account history.
import {spawn} from 'node:child_process';
import {readAdsSnapshot} from '../imports/ads-store.js';
import {readArchivedAdsSnapshot} from '../imports/archive-ads.js';
import {advertisingModel,snapshotRows,aggregate} from '../unified/model.js';
import {addDecimal} from '../native/google-receiver.js';
const query=(sql,params=[])=>new Promise((resolve,reject)=>{const p=spawn('python',['recovery-tests/read-only-d1.py']);let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('close',code=>{if(code)reject(new Error(err));else try{resolve(JSON.parse(out).results);}catch(e){reject(e);}});p.stdin.end(JSON.stringify({sql,params}));});
const db={prepare(sql){return {params:[],bind(...params){this.params=params;return this;},async first(){return (await query(sql,this.params))[0]||null;},async all(){return {results:await query(sql,this.params)};}};}};
const integrations=await query("SELECT i.id AS integrationId,i.status,i.external_account_id AS accountId,i.provider,i.config_json,p.id AS projectId,p.organization_id AS organizationId,p.slug AS projectSlug FROM integrations i JOIN projects p ON p.id=i.project_id WHERE p.slug='profkit-instashop-r4vk' AND i.provider='meta_ads'");
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),from=process.argv[2]||'2026-09-13',to=process.argv[3]||date,providers=[];
for(const row of integrations){if(row.status==='pending')continue;const config=JSON.parse(row.config_json),scope={...row,timezone:config.accountTimezone,currency:config.expectedCurrency,config};const data=config.readOnlyArchive?await readArchivedAdsSnapshot(db,scope,from,to):await readAdsSnapshot(db,scope,from,to);if(!data){console.log(JSON.stringify({accountId:row.accountId,ready:false}));continue;}if(config.accountCreatedDate)data.activeFromDate=config.accountCreatedDate;providers.push(data);}
// Read the published advertising baseline through the same fact reader used by
// the dashboard. This helper has SELECT-only remote access, not an auth bypass.
const folder=mkdtempSync(join(tmpdir(),'profkit-readback-'));
await build({stdin:{contents:readFileSync('runtime/backend.js','utf8')+'\nexport {releaseRecord,factRows};',resolveDir:resolve('runtime')},outfile:join(folder,'read.mjs'),bundle:true,format:'esm',platform:'node',plugins:[{name:'cf-read-only',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cf',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export class WorkerEntrypoint {}'}));}}]});
const rt=await import(pathToFileURL(join(folder,'read.mjs')));rmSync(folder,{recursive:true,force:true});
const project={id:'prj_profkit_instashop_r4vk',organizationId:'org_toys_agency'},release=await rt.releaseRecord({TOYS_DB:db},project),manifest=JSON.parse(release.manifestJson);const descriptor=manifest.datasets.find(d=>d.key==='profkit_meta');if(!descriptor)throw Error('Published advertising baseline missing');
const baseline=await rt.factRows({TOYS_DB:db},project,descriptor.generationId),dashboard={instashop:{ads:{rows:baseline}}};
const rows=advertisingModel(dashboard, {providers},{from,to});
const control=[];for(const p of providers){for(const d of p.hierarchy.dailyMetrics||[]){const actual=rows.filter(r=>r.integrationId===p.integrationId&&r.date===d.date).reduce((s,r)=>s+Number(r.spend||0),0),expected=Number(d.metrics?.spend?.value||0);if(Math.abs(actual-expected)>0.011)control.push({integration:p.integrationId,date:d.date,actual,expected});}}if(control.length)throw Error('Account and campaign daily totals disagree: '+JSON.stringify(control));
const daily={};for(const r of rows){const key=r.date+':'+r.currency;if(!daily[key])daily[key]={date:r.date,currency:r.currency,spend:'0',accounts:new Set()};daily[key].spend=addDecimal(daily[key].spend,String(r.spend||0));daily[key].accounts.add(integrations.find(i=>i.integrationId===r.integrationId)?.accountId);}
console.log(JSON.stringify({range:{from,to},publishedBaselineRows:baseline.length,dailyAccountReconciliation:'matched',sources:providers.map(p=>({accountId:p.hierarchy.providerId,integrationId:p.integrationId,archive:!!p.readOnlyArchive,currency:p.hierarchy.currency,timezone:p.hierarchy.timezone,dates:p.coveredDates.length,activeFromDate:p.activeFromDate,coverage:p.coverage,freshness:p.freshness})),totals:aggregate(rows),accountTotals:providers.map(p=>({accountId:p.hierarchy.providerId,...aggregate(rows.filter(r=>r.integrationId===p.integrationId))})),daily:Object.values(daily).sort((a,b)=>a.date.localeCompare(b.date)||a.currency.localeCompare(b.currency)).map(d=>({...d,accounts:[...d.accounts]}))},null,2));
