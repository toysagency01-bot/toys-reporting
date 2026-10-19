import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
import {crypt,enable,ingest,updateLead} from '../crm/service.js';
import {drain} from '../crm/delivery.js';
import {runMetaLeadSync,metaSyncStatus} from '../crm/meta-sync.js';
import {connectDirectMeta} from '../crm/direct-meta.js';

const p={id:'prj_housevip_cxp7',slug:'housevip-cxp7',timezone:'Asia/Tbilisi'};
const at=Date.parse('2026-10-19T10:00:00Z'),n=new Date(at).toISOString();
async function setup(){
 const f=fixture();f.env.CRM_ENCRYPTION_KEY=btoa('x'.repeat(32));f.env.META_ADS_ACCESS_TOKEN='synthetic-current-token';
 await enable(f.env,p);
 f.db.prepare('INSERT INTO crm_pages(page_id,name,project_id,token_cipher,discovered_at,updated_at) VALUES(?,?,?,?,?,?)').run('123','Synthetic',p.id,await crypt(f.env,'synthetic-page'),n,n);
 f.db.prepare("INSERT INTO integrations(id,project_id,provider,external_account_id,status) VALUES('meta-source',?,'meta_ads','987','active')").run(p.id);
 f.db.prepare('INSERT INTO crm_meta_sources(page_id,project_id,account_id,app_id,live_since,history_from,history_to,next_attempt_at,connected_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('123',p.id,'987','123456','2026-10-18T20:00:00Z','2025-10-18T20:00:00Z',n,n,n,n,n);
 f.db.prepare('UPDATE crm_meta_sources SET history_enabled=1').run();
 return f;
}
test('admin-only CRM blocks assigned teams and clients on list, detail, writes, summary and shell; neighboring reports remain available',async()=>{
 const {env,db}=await setup();const worker=await testWorker();try{
  db.prepare("UPDATE crm_projects SET access_mode='admin'").run();
  const base='/api/v2/projects/'+p.slug;
  for(const role of ['viewer','editor']){
   for(const path of ['/crm','/crm/summary','/crm/leads/unknown','/content-crm','/content-crm?format=json'])assert.equal((await worker.fetch(request(base+path,{role}),env)).status,403,path);
   assert.equal((await worker.fetch(request(base+'/crm',{role,method:'POST',body:{email:'secret@example.test'}}),env)).status,403);
   const html=await(await worker.fetch(request('/'+p.slug+'/',{role}),env)).text();assert.ok(html.includes('window.TOYS_CRM_ALLOWED=false'));
   assert.equal((await worker.fetch(request(base+'/content/reports',{role}),env)).status,200);
  }
  env.MVP_EDITOR_PROJECTS+=',__master';
  assert.equal((await worker.fetch(request(base+'/crm'),env)).status,200);
  const html=await(await worker.fetch(request('/'+p.slug+'/'),env)).text();assert.ok(html.includes('window.TOYS_CRM_ALLOWED=true'));
 }finally{db.close();}
});
test('paged history resumes from durable cursors, deduplicates IDs and creates no qualification events',async()=>{
 const {env,db}=await setup();try{
  let page=0;env.CRM_FETCH=async raw=>{const u=new URL(raw);if(u.pathname.endsWith('/leadgen_forms'))return Response.json({data:[{id:'222',name:'Form'}]});
   assert.ok(u.pathname.endsWith('/222/leads'));assert.equal(u.searchParams.get('fields'),'id,created_time');
   if(page++===0)return Response.json({data:[{id:'444',created_time:'2026-09-01T00:00:00Z'}],paging:{next:'https://graph.facebook.com/unused',cursors:{after:'next-page'}}});
   assert.equal(u.searchParams.get('after'),'next-page');return Response.json({data:[{id:'444',created_time:'2026-09-01T00:00:00Z'},{id:'555',created_time:'2026-09-02T00:00:00Z'}]});};
  await runMetaLeadSync(env,at);
  assert.equal(db.prepare('SELECT cursor FROM crm_meta_forms').get().cursor,'next-page');
  await runMetaLeadSync(env,at+120000);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM crm_delivery').get().n,2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM crm_milestones').get().n,0);
  const status=(await metaSyncStatus(env,p.id))[0];assert.equal(status.forms,1);assert.equal(status.scannedForms,1);assert.equal(status.delivered,0);
  assert.equal(db.prepare('SELECT cursor FROM crm_meta_forms').get().cursor,null);
 }finally{db.close();}
});
test('failed reads preserve import progress, sanitize provider errors and apply a retry delay',async()=>{
 const {env,db}=await setup();try{
  db.prepare('INSERT INTO crm_meta_forms(page_id,form_id,name,cursor,next_scan_at,discovered_at) VALUES(?,?,?,?,?,?)').run('123','222','Form','saved',n,n);
  db.prepare('UPDATE crm_meta_sources SET forms_checked_at=?').run(n);
  env.CRM_FETCH=async()=>Response.json({error:{code:190,error_subcode:463,message:'DO NOT STORE private token'}},{status:400});
  await runMetaLeadSync(env,at);
  assert.equal(db.prepare('SELECT cursor FROM crm_meta_forms').get().cursor,'saved');
  const s=db.prepare('SELECT * FROM crm_meta_sources').get();assert.equal(s.last_error,'leads:meta_190:463@object/leads');assert.equal(s.state,'error');assert.ok(s.next_attempt_at>n);assert.equal(s.lease_token,null);
 }finally{db.close();}
});
test('live-only reconciliation ignores historical cursors, starts at midnight and resumes its own pages',async()=>{
 const {env,db}=await setup();try{
  db.prepare('UPDATE crm_meta_sources SET history_enabled=0,forms_checked_at=?').run(n);
  db.prepare('INSERT INTO crm_meta_forms(page_id,form_id,name,cursor,scan_from,scan_to,next_scan_at,discovered_at) VALUES(?,?,?,?,?,?,?,?)').run('123','222','Form','historical-cursor','2025-10-18T20:00:00Z',n,n,n);
  let calls=0;
  env.CRM_FETCH=async raw=>{const u=new URL(raw),filter=JSON.parse(u.searchParams.get('filtering'));
   assert.equal(filter[0].value,Date.parse('2026-10-18T20:00:00Z')/1000-1);
   if(calls++===0){assert.equal(u.searchParams.get('after'),null);return Response.json({data:[{id:'444',created_time:'2026-09-01T00:00:00Z'},{id:'555',created_time:'2026-10-19T01:00:00Z'}],paging:{next:'https://graph.facebook.com/unused',cursors:{after:'live-next'}}});}
   assert.equal(u.searchParams.get('after'),'live-next');return Response.json({data:[{id:'555',created_time:'2026-10-19T01:00:00Z'},{id:'666',created_time:'2026-10-19T02:00:00Z'}]});
  };
  await runMetaLeadSync(env,at);await runMetaLeadSync(env,at+120000);
  const jobs=db.prepare('SELECT source_id,payload_json FROM crm_delivery ORDER BY source_id').all();assert.deepEqual(jobs.map(x=>x.source_id),['555','666']);assert.ok(jobs.every(x=>JSON.parse(x.payload_json).sourceMode==='reconcile'));
  assert.equal((await metaSyncStatus(env,p.id))[0].historyEnabled,0);
 }finally{db.close();}
});
test('live-only delivery blocks old queued history and wrong-account leads even inside retained history bounds',async()=>{
 const {env,db}=await setup();try{
  db.prepare('UPDATE crm_meta_sources SET history_enabled=0').run();
  const now=new Date().toISOString();
  for(const id of ['444','555','666'])db.prepare("INSERT INTO crm_delivery(id,project_id,kind,source_id,payload_json,next_attempt_at,created_at) VALUES(?,?,'meta_lead',?,?,?,?)").run(id,p.id,id,JSON.stringify({pageId:'123',formId:'222',sourceMode:'history'}),now,now);
  env.CRM_FETCH=async raw=>{const u=new URL(raw),id=u.pathname.split('/').at(-1);
   if(id==='777'||id==='888')return Response.json({id,account_id:id==='777'?'987':'999'});
   return Response.json({id,form_id:'222',created_time:id==='444'?'2026-09-01T00:00:00Z':'2026-10-19T01:00:00Z',ad_id:id==='555'?'888':'777',field_data:[{name:'full_name',values:['Synthetic '+id]},{name:'phone_number',values:['+12345']}]});
  };
  await drain(env);
  assert.equal(db.prepare("SELECT last_error FROM crm_delivery WHERE id='444'").get().last_error,'lead_before_live_start');
  assert.equal(db.prepare("SELECT last_error FROM crm_delivery WHERE id='555'").get().last_error,'lead_account_mismatch');
  assert.equal(db.prepare("SELECT state FROM crm_delivery WHERE id='666'").get().state,'sent');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM crm_milestones').get().n,0);
 }finally{db.close();}
});
test('live intake rejects other ad accounts, while historical page leads import without generating CAPI or changing statuses',async()=>{
 const {env,db}=await setup();try{
  const now=new Date().toISOString();
  db.prepare("UPDATE crm_meta_sources SET live_since='2026-10-18T20:00:00Z',history_to='2026-10-18T20:00:00Z'").run();
  const queue=(id,mode)=>db.prepare("INSERT INTO crm_delivery(id,project_id,kind,source_id,payload_json,next_attempt_at,created_at) VALUES(?,?,'meta_lead',?,?,?,?)").run(id,p.id,id,JSON.stringify({pageId:'123',formId:'222',sourceMode:mode}),now,now);
  queue('444','reconcile');queue('555','history');
  env.CRM_FETCH=async raw=>{const u=new URL(raw);if(u.pathname.endsWith('/777'))return Response.json({id:'777',account_id:'999'});const id=u.pathname.split('/').at(-1);return Response.json({id,form_id:'222',created_time:id==='555'?'2026-09-01T00:00:00Z':now,ad_id:'777',field_data:[{name:'full_name',values:['Synthetic Name']},{name:'phone_number',values:['+12345']}]});};
  await drain(env);assert.equal(db.prepare("SELECT last_error FROM crm_delivery WHERE id='444'").get().last_error,'lead_account_mismatch');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,1);const lead=db.prepare('SELECT * FROM leads').get();assert.equal(lead.name,'Synthetic Name');assert.equal(lead.current_status,'Новый');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM crm_delivery WHERE kind='capi'").get().n,0);
 }finally{db.close();}
});
test('CAPI setup verifies dataset belongs to selected account; no conversion is sent during configuration',async()=>{
 const {env,db}=await setup();try{
  db.prepare("UPDATE crm_projects SET dataset_id='333333',capi_setup_state='pending',capi_kinds='qualified'").run();
  env.CRM_FETCH=async raw=>{const u=new URL(raw);assert.ok(!u.pathname.endsWith('/events'));if(u.pathname.endsWith('/adspixels'))return Response.json({data:[{id:'333333'}]});if(u.pathname.endsWith('/333333'))return Response.json({id:'333333'});return Response.json({data:[]});};
  await runMetaLeadSync(env,at);
  const cfg=db.prepare('SELECT * FROM crm_projects').get();assert.equal(cfg.capi_enabled,1);assert.equal(cfg.capi_setup_state,'configured');assert.equal(await crypt(env,cfg.capi_token_cipher,true),'synthetic-current-token');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM crm_milestones').get().n,0);
 }finally{db.close();}
});
test('CAPI connection cutoff and selected kinds prevent sending old qualifications and unrequested sales',async()=>{
 const {env,db}=await setup();try{
  const lead=await ingest(env,p,{email:'synthetic@example.test'},'meta_lead_ads','444');
  await updateLead(env,p,lead.id,{status:'Квалифицирован',version:1},'synthetic','q');
  await updateLead(env,p,lead.id,{status:'Продажа',version:2,value:'10',currency:'EUR'},'synthetic','s');
  db.prepare("UPDATE crm_projects SET capi_enabled=1,dataset_id='333333',capi_token_cipher=?,capi_from=?,capi_kinds='qualified'").run(await crypt(env,'synthetic'),new Date(Date.now()-1000).toISOString());
  db.prepare("UPDATE crm_milestones SET occurred_at=? WHERE kind='qualified'").run(new Date(Date.now()-2000).toISOString());
  env.CRM_FETCH=async()=>{assert.fail('No old or sale event should reach Meta');};
  await drain(env);const errors=db.prepare('SELECT last_error FROM crm_delivery ORDER BY last_error').all().map(x=>x.last_error);assert.deepEqual(errors,['event_before_connection','event_kind_disabled']);
 }finally{db.close();}
});
test('qualification-only configuration retains sale statistics without scheduling an unwanted sale event',async()=>{
 const {env,db}=await setup();try{
  db.prepare("UPDATE crm_projects SET capi_kinds='qualified'").run();
  const lead=await ingest(env,p,{email:'synthetic@example.test'},'meta_lead_ads','444');
  await updateLead(env,p,lead.id,{status:'Квалифицирован',version:1},'synthetic','only-qualified');
  await updateLead(env,p,lead.id,{status:'Продажа',version:2,value:'10',currency:'EUR'},'synthetic','keep-sale');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM crm_milestones').get().n,2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM crm_delivery').get().n,1);
 }finally{db.close();}
});
test('explicit page reconnection refreshes a stale cached token from the active app credential',async()=>{
 const {env,db}=await setup();try{
  env.CRM_VERIFY_TOKEN='synthetic-verify';env.META_APP_SECRET='a'.repeat(32);
  env.CRM_META_ACCESS_TOKEN='synthetic-crm-token';
  let checked=false;
  env.CRM_FETCH=async(raw,options)=>{const u=new URL(raw),path=u.pathname.replace('/v26.0/','');
   if(path==='123456')return Response.json({id:'123456',name:'App'});
   if(path==='123'){assert.equal(options.headers.authorization,'Bearer synthetic-crm-token');return Response.json({id:'123',access_token:'fresh-page'});}
   if(path==='debug_token'){assert.equal(u.searchParams.get('input_token'),'fresh-page');checked=true;return Response.json({data:{is_valid:true,app_id:'123456'}});}
   if(path==='me')return Response.json({id:'123',name:'Page'});
   if(path==='123/leadgen_forms')return Response.json({data:[{id:'222'}]});
   if(path==='222/leads')return Response.json({data:[]});
   if(path==='123456/subscriptions')return Response.json({data:[{object:'page',callback_url:'https://reports.toys-agency.com/api/crm/meta',active:true,fields:['leadgen']}]});
   if(path==='123/subscribed_apps')return Response.json({data:[{id:'123456',subscribed_fields:['leadgen']}]});
   assert.fail(path);
  };
  const result=await connectDirectMeta(env,p,{pageId:'123',appId:'123456',refreshToken:true,action:'check'});assert.equal(result.leadReadAccess,true);assert.ok(checked);
  assert.equal(env.META_ADS_ACCESS_TOKEN,'synthetic-current-token');
  assert.equal(await crypt(env,db.prepare('SELECT token_cipher FROM crm_pages').get().token_cipher,true),'synthetic-page');
 }finally{db.close();}
});
