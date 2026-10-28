import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fixture,testWorker} from './fixture.mjs';
import {roleBrowserFixture} from './roles-browser-fixture.mjs';
import {normalizeSetup} from '../project-management/model.js';
import {parseAdvertisingCSV} from '../project-management/csv.js';
import {syncManagedKeyCRM} from '../project-management/keycrm.js';
import {snapshotRows} from '../unified/model.js';
const worker=await testWorker();
const setup=(name='Synthetic managed project')=>({name,type:'leadgen',company:'Synthetic company',timezone:'Europe/Kyiv',currency:'EUR',channels:['meta'],crm:{kind:'internal',qualification:'Verified need'},kpi:{metric:'leads',target:30,budget:500,maxCost:15},brief:{product:'Synthetic product',text:'<img src=x onerror=alert(1)>'},startDate:'2026-10-28',launchDate:'2026-11-02',notes:{strategy:'Synthetic strategy'}});
function context(){const f=fixture(),tokens=roleBrowserFixture(f.env,f.db);f.env.CRM_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
 const call=(who,path,body,method=body?'POST':'GET',key=crypto.randomUUID())=>worker.fetch(new Request('https://test.local'+path,{method,headers:{cookie:'__Host-toys_session='+tokens[who],origin:'https://test.local','content-type':'application/json','x-idempotency-key':key},...body?{body:JSON.stringify(body)}:{}}),f.env,{});
 return {...f,tokens,call};}
async function create(f,data=setup(),who='team',key=crypto.randomUUID()){const response=await f.call(who,'/api/v2/master/projects',{setup:data},'POST',key);const body=await response.json();assert.equal(response.status,201,JSON.stringify(body));return body;}
test('team creates one private project with a normal live route, automatic scope, materials and safe retries',async()=>{
 const f=context();try{
 const key='new-project-stable-key',data=setup();const first=await create(f,data,'team',key),id=first.project.id,slug=first.project.slug,base='/api/v2/projects/'+slug;
 assert.equal(f.db.prepare('SELECT role FROM project_memberships WHERE project_id=?').get(id).role,'buyer');
 const again=await f.call('team','/api/v2/master/projects',{setup:data},'POST',key);assert.equal(again.status,200);assert.equal((await again.json()).project.id,id);
 assert.equal((await f.call('team','/api/v2/master/projects',{setup:{...data,name:'Different'}},'POST',key)).status,409);
 assert.equal((await f.call('team','/api/v2/master/projects',{setup:data})).status,409);
 for(const path of ['/'+slug+'/',base+'/board',base+'/dashboard',base+'/content/tabs',base+'/crm'])assert.equal((await f.call('team',path)).status,200,path);
 const d=await(await f.call('team',base+'/dashboard')).json();assert.equal(d.dashboard.coverage.availability,'not_configured');assert.deepEqual(snapshotRows(d.dashboard),[]);
 const master=await(await f.call('team','/api/v2/master')).json();assert.ok(master.projects.some(p=>p.slug===slug&&p.managed));
 const chooser=await(await f.call('team','/api/v2/portal/session?choose=1')).text();assert.ok(chooser.includes('href="/'+slug+'/"'));
 assert.equal((await f.call('empty',base+'/dashboard')).status,403);assert.equal((await f.call('client','/api/v2/master/projects/'+slug+'/setup')).status,403);
 assert.equal((await f.call('client','/api/v2/master/projects',{setup:setup('Forbidden')})).status,403);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM integrations WHERE project_id=?').get(id).n,0);
 const anon=await worker.fetch(new Request('https://test.local'+base+'/dashboard'),f.env,{});assert.equal(anon.status,401);
 }finally{f.db.close();}
});
test('all supported project types boot without fabricated releases and settings preserve stale-write boundaries',async()=>{
 const f=context();try{for(const type of ['leadgen','ecommerce','instashop']){
  const d=setup('Synthetic '+type);d.type=type;d.crm.kind='none';d.channels=['meta','google'];const result=await create(f,d,'admin'),slug=result.project.slug,path='/api/v2/master/projects/'+slug+'/setup';
  assert.equal((await f.call('admin','/api/v2/projects/'+slug+'/dashboard')).status,200);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM project_tabs WHERE project_id=?').get(result.project.id).n,12);
  const before=await(await f.call('admin',path)).json();const changed={...before.setup,name:'Changed '+type};const update=await f.call('admin',path,{setup:changed,version:1},'PATCH');assert.equal(update.status,200,JSON.stringify(await update.clone().json()));assert.equal((await f.call('admin',path,{setup:before.setup,version:1},'PATCH')).status,409);
  assert.equal((await(await f.call('admin',path)).json()).setup.name,changed.name);
 }}finally{f.db.close();}
});
test('new dynamic project grants reach readers while private setup and mutations remain protected',async()=>{
 const f=context();try{const result=await create(f),slug=result.project.slug;
 const grant=await f.call('team','/api/v2/master/access',{email:'reader-managed@roles.test',name:'Reader',role:'client',projects:[slug],enabled:true,version:0});assert.equal(grant.status,200);const u=await grant.json();
 assert.equal(f.db.prepare('SELECT role FROM project_memberships WHERE user_id=?').get(u.id).role,'client_viewer');
 assert.equal((await f.call('empty','/api/v2/master/projects/'+slug+'/setup')).status,403);
 }finally{f.db.close();}
});
test('source linking verifies the actual account and rejects duplicate ownership or a revoked actor',async()=>{
 const f=context();try{f.env.META_ADS_ACCESS_TOKEN='synthetic-private-token';const result=await create(f),slug=result.project.slug,path='/api/v2/master/projects/'+slug+'/setup/meta';let calls=0;
 f.env.PROJECT_SETUP_FETCH=async(url,options)=>{calls++;assert.equal(new URL(url).hostname,'graph.facebook.com');assert.equal(options.redirect,'manual');return Response.json({account_id:'123456789',name:'Synthetic account',currency:'PLN',timezone_name:'Europe/Warsaw'});};
 const linked=await f.call('team',path,{accountId:'123456789'});assert.equal(linked.status,200,JSON.stringify(await linked.clone().json()));const i=f.db.prepare('SELECT * FROM integrations WHERE project_id=?').get(result.project.id);assert.equal(JSON.parse(i.config_json).expectedCurrency,'PLN');assert.equal(JSON.parse(i.config_json).accountTimezone,'Europe/Warsaw');
 const other=await create(f,setup('Second managed'));assert.equal((await f.call('team','/api/v2/master/projects/'+other.project.slug+'/setup/meta',{accountId:'123456789'})).status,409);assert.equal(calls,1);
 const third=await create(f,setup('Revoked managed'));f.env.PROJECT_SETUP_FETCH=async()=>{f.db.prepare("DELETE FROM project_memberships WHERE user_id='role-team' AND project_id=?").run(third.project.id);return Response.json({account_id:'987654321',name:'No longer allowed',currency:'EUR',timezone_name:'UTC'});};
 assert.notEqual((await f.call('team','/api/v2/master/projects/'+third.project.slug+'/setup/meta',{accountId:'987654321'})).status,200);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM integrations WHERE project_id=?').get(third.project.id).n,0);
 }finally{f.db.close();}
});
test('Google CSV imports accepted values without inventing absent dates and preserves other date intervals',async()=>{
 const f=context();try{const d=setup('Google source');d.channels=['google'];const result=await create(f,d),slug=result.project.slug,path='/api/v2/master/projects/'+slug+'/setup/google-csv';
 const row={date:'2026-10-28',campaign:'Synthetic campaign',impressions:100,clicks:9,spend:12.5,conversions:2,currency:'EUR'};
 const r=await f.call('team',path,{accountId:'1234567890',rows:[row]});assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
 const dash=await(await f.call('team','/api/v2/projects/'+slug+'/dashboard?from=2026-10-28&toExclusive=2026-10-29')).json();const rows=snapshotRows(dash.dashboard);assert.equal(rows.length,1);assert.equal(rows[0].spend,12.5);assert.equal(rows[0].conversions,2);
 assert.equal((await f.call('team',path,{accountId:'1234567890',rows:[{...row,date:'2026-10-29',spend:8}]})).status,200);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM project_setup_ad_rows WHERE project_id=?').get(result.project.id).n,2);
 assert.equal((await f.call('team',path,{accountId:'1234567890',rows:[{...row,spend:-1}]})).status,400);
 const h=await f.call('team','/api/v2/projects/'+slug+'/content-project/ads/hierarchy?from=2026-10-28&to=2026-10-29');assert.equal(h.status,200,JSON.stringify(await h.clone().json()));
 }finally{f.db.close();}
});
test('KeyCRM credentials stay encrypted and paginated qualification imports are project-scoped',async()=>{
 const f=context();try{const data=setup('KeyCRM source');data.crm.kind='keycrm';const created=await create(f,data),base='/api/v2/master/projects/'+created.project.slug+'/setup';let current='metadata';
 f.env.PROJECT_SETUP_FETCH=async(url,options)=>{assert.equal(options.redirect,'manual');assert.equal(new URL(url).hostname,'openapi.keycrm.app');if(url.includes('/cards?'))return Response.json({current_page:1,last_page:1,total:1,data:[{id:91,pipeline_id:1,status_id:2,created_at:'2026-10-28 10:00:00',utm_source:'toys'}]});if(url.includes('/statuses?'))return Response.json({last_page:1,data:[{id:2,title:'Qualified'}]});return Response.json({last_page:1,data:[{id:1,title:'Pipeline'}]});};
 const checked=await f.call('team',base+'/keycrm-check',{token:'synthetic-secret-token'});assert.equal(checked.status,200);assert.ok(!(await checked.text()).includes('synthetic-secret-token'));
 const encrypted=f.db.prepare('SELECT token_cipher FROM project_setup_connections WHERE project_id=?').get(created.project.id).token_cipher;assert.ok(!encrypted.includes('synthetic-secret-token'));
 assert.equal((await f.call('team',base+'/keycrm',{pipelineId:'1',statusIds:['2'],utmSource:'toys'})).status,200);
 await syncManagedKeyCRM(f.env,created.project.id);
 const summary=await(await f.call('team','/api/v2/master/projects/'+created.project.slug+'/summary?from=2026-10-28&to=2026-10-28')).json();assert.equal(summary.crm.qualified,1);assert.equal(summary.crm.coverage.historicalStatusCoverage,'observed_only');
 }finally{f.db.close();}
});
test('setup validation and CSV parsing reject invalid or ambiguous input',()=>{
 assert.throws(()=>normalizeSetup({...setup(),website:'javascript:alert(1)'}));assert.throws(()=>normalizeSetup({...setup(),channels:[]}));assert.throws(()=>normalizeSetup({...setup(),timezone:'not-a-zone'}));
 const rows=parseAdvertisingCSV('date,campaign,impressions,clicks,cost,conversions,currency\n2026-10-28,"Campaign, A",100,2,5.50,1,EUR');assert.equal(rows[0].campaign,'Campaign, A');assert.equal(rows[0].spend,5.5);
 assert.throws(()=>parseAdvertisingCSV('date,campaign\n2026-10-28,A'));
});
test('managed projects support ordinary report editing and directly verified Google Ads API credentials',async()=>{
 const f=context();try{
 const data=setup('Google API source');data.channels=['google'];const created=await create(f,data),slug=created.project.slug,base='/api/v2/projects/'+slug,connection='/api/v2/master/projects/'+slug+'/setup/google-api';
 const reportKey='weekly-'+crypto.randomUUID();const initialized=await f.call('team',base+'/content/'+reportKey+'/initialize',{});assert.equal(initialized.status,200,JSON.stringify(await initialized.clone().json()));
 const report=await f.call('team',base+'/content/'+reportKey+'/save-and-publish',{expectedRevision:0,expectedPublishedRevisionId:null,blocks:[{type:'period_summary',blockKey:'summary',payload:{periodStart:'2026-10-01',periodEnd:'2026-10-28',channel:'google',summary:'First managed report'}}]});assert.equal(report.status,201,JSON.stringify(await report.clone().json()));
 f.env.PROJECT_SETUP_FETCH=async(url,options)=>{
  assert.equal(options.redirect,'manual');if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'synthetic-access'});
  assert.equal(new URL(url).hostname,'googleads.googleapis.com');const query=JSON.parse(options.body).query;
  if(query.includes('FROM customer'))return Response.json([{results:[{customer:{id:'1234567890',currencyCode:'GBP',timeZone:'Europe/London'}}]}]);
  const common={segments:{date:'2026-10-28'},metrics:{impressions:'100',clicks:'5',costMicros:'12500000',conversions:2,conversionsValue:20},campaign:{id:'101',name:'API campaign',status:'ENABLED'}};
  if(query.includes('FROM ad_group_ad'))return Response.json([{results:[{...common,adGroup:{id:'201'},adGroupAd:{ad:{id:'301'},status:'ENABLED'}}]}]);
  if(query.includes('FROM ad_group'))return Response.json([{results:[{...common,adGroup:{id:'201',name:'API group',status:'ENABLED'}}]}]);
  return Response.json([{results:[common]}]);
 };
 const credentials={accountId:'1234567890',clientId:'private-id',clientSecret:'private-secret',refreshToken:'private-refresh',developerToken:'private-developer'};
 const connected=await f.call('team',connection,credentials);assert.equal(connected.status,200,JSON.stringify(await connected.clone().json()));assert.ok(!(await connected.text()).includes('private-secret'));
 const stored=f.db.prepare("SELECT token_cipher FROM project_setup_connections WHERE project_id=? AND provider='google_ads'").get(created.project.id);assert.ok(!stored.token_cipher.includes('private-secret'));
 const h=await f.call('team',base+'/content-project/ads/hierarchy?from=2026-10-28&to=2026-10-28');assert.equal(h.status,200,JSON.stringify(await h.clone().json()));const payload=await h.json();assert.equal(payload.providers[0].hierarchy.currency,'GBP');assert.equal(payload.providers[0].hierarchy.children[0].name,'API campaign');assert.equal(payload.providers[0].hierarchy.children[0].children[0].children[0].providerId,'301');
 }finally{f.db.close();}
});
test('website intake keys and CAPI are scoped to the new project and dataset membership is verified',async()=>{
 const f=context();try{const d=setup('Website and CAPI');d.crm.capi=true;const created=await create(f,d),path='/api/v2/master/projects/'+created.project.slug+'/setup';
 const key=await(await f.call('team',path+'/website-key',{})).json();assert.equal(key.ok,true);assert.ok(key.key.length>=32);assert.ok(!f.db.prepare('SELECT website_key_hash FROM crm_projects WHERE project_id=?').get(created.project.id).website_key_hash.includes(key.key));
 const ingest=await worker.fetch(new Request(key.endpoint,{method:'POST',headers:{authorization:'Bearer '+key.key,'content-type':'application/json'},body:JSON.stringify({submissionId:'unique-submission',name:'Synthetic lead',phone:'+123456789'})}),f.env,{});assert.equal(ingest.status,201);
 f.env.META_ADS_ACCESS_TOKEN='synthetic';f.env.PROJECT_SETUP_FETCH=async url=>url.includes('/adspixels?')?Response.json({data:[{id:'777777'}]}):url.includes('act_')?Response.json({account_id:'123456789',name:'Synthetic account',currency:'EUR',timezone_name:'UTC'}):Response.json({id:'777777'});
 assert.equal((await f.call('team',path+'/capi',{datasetId:'777777',token:'synthetic-capi-key'})).status,400);
 assert.equal((await f.call('team',path+'/meta',{accountId:'123456789'})).status,200);
 assert.equal((await f.call('team',path+'/capi',{datasetId:'888888',token:'synthetic-capi-key'})).status,400);
 const capi=await f.call('team',path+'/capi',{datasetId:'777777',token:'synthetic-capi-key'});assert.equal(capi.status,200,JSON.stringify(await capi.clone().json()));const saved=f.db.prepare('SELECT capi_enabled,capi_token_cipher FROM crm_projects WHERE project_id=?').get(created.project.id);assert.equal(saved.capi_enabled,1);assert.ok(!saved.capi_token_cipher.includes('synthetic-capi-key'));
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM crm_delivery WHERE project_id=?').get(created.project.id).n,0);
 assert.equal((await f.call('team',path+'/disconnect',{provider:'capi'})).status,200);assert.equal(f.db.prepare('SELECT capi_token_cipher FROM crm_projects WHERE project_id=?').get(created.project.id).capi_token_cipher,null);
 }finally{f.db.close();}
});
