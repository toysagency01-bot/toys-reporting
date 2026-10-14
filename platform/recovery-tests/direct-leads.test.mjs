import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
import {crypt,enable,ingest,updateLead} from '../crm/service.js';
import {connectDirectMeta,META_CALLBACK} from '../crm/direct-meta.js';
import {webhook,signature,drain} from '../crm/delivery.js';

const p={id:'prj_housevip_cxp7',slug:'housevip-cxp7',timezone:'Asia/Tbilisi'},pageId='123456',appId='654321';
async function setup(){
 const f=fixture();f.env.CRM_ENCRYPTION_KEY=btoa('k'.repeat(32));f.env.CRM_VERIFY_TOKEN='synthetic-verify';f.env.META_APP_SECRET='a'.repeat(32);await enable(f.env,p);
 f.db.prepare('INSERT INTO crm_pages(page_id,name,project_id,token_cipher,discovered_at,updated_at) VALUES(?,?,?,?,?,?)').run(pageId,'Synthetic page',p.id,await crypt(f.env,'synthetic-page-token'),new Date().toISOString(),new Date().toISOString());
 return f;
}
function graphSetup(env,{callback=null,pageFields=['messages'],tokenAppId=appId,leadAccess=true}={}){
 const state={writes:[],reads:[],callback,pageFields};
 env.CRM_FETCH=async(address,options)=>{
  const url=new URL(address),path=url.pathname.replace('/v26.0/','');assert.equal(url.origin,'https://graph.facebook.com');assert.equal(options.redirect,'manual');assert.ok(options.signal);
  if(options.method==='POST'){
   state.writes.push({path,fields:options.body.get('fields')||options.body.get('subscribed_fields')});
   if(path===appId+'/subscriptions'){assert.equal(options.body.get('verify_token'),'synthetic-verify');state.callback={object:'page',callback_url:options.body.get('callback_url'),active:true,fields:options.body.get('fields').split(',').map(name=>({name}))};}
   else if(path===pageId+'/subscribed_apps')state.pageFields=options.body.get('subscribed_fields').split(',');
   else throw Error('Unexpected mutation');return Response.json({success:true});
  }
  state.reads.push(path);
  if(path===appId)return Response.json({id:appId,name:'Synthetic app'});
  if(path==='debug_token')return Response.json({data:{is_valid:true,app_id:tokenAppId}});
  if(path==='me')return Response.json({id:pageId,name:'Synthetic page'});
  if(path===pageId+'/leadgen_forms')return Response.json({data:[{id:'777',name:'Form'}]});
  if(path==='777/leads'){assert.equal(url.searchParams.get('fields'),'id');return leadAccess?Response.json({data:[]}):Response.json({error:{code:200}},{status:403});}
  if(path===appId+'/subscriptions')return Response.json({data:state.callback?[state.callback]:[]});
  if(path===pageId+'/subscribed_apps')return Response.json({data:[{id:appId,subscribed_fields:state.pageFields}]});
  throw Error('Unexpected read');
 };return state;
}
test('direct setup validates access, preserves existing fields, verifies both subscriptions and retries idempotently',async()=>{
 const {env,db}=await setup();try{
  const state=graphSetup(env,{callback:{object:'page',callback_url:META_CALLBACK,active:true,fields:[{name:'messages'}]}});
  const check=await connectDirectMeta(env,p,{pageId,appId,action:'check'});assert.equal(check.leadReadAccess,true);assert.equal(check.callbackReady,false);assert.equal(state.writes.length,0);
  const result=await connectDirectMeta(env,p,{pageId,appId});assert.equal(result.state,'awaiting_lead');assert.equal(result.pageReady,true);
  assert.deepEqual(state.writes.map(x=>x.fields),['messages,leadgen','messages,leadgen']);
  const stored=db.prepare('SELECT * FROM crm_pages').get();assert.equal(stored.subscribed,1);assert.equal(stored.app_id,appId);assert.equal(await crypt(env,stored.app_secret_cipher,true),env.META_APP_SECRET);
  await connectDirectMeta(env,p,{pageId,appId});assert.equal(state.writes.length,2);assert.ok(!JSON.stringify(result).includes('synthetic-page-token'));
 }finally{db.close();}
});
test('different application callbacks, wrong token application, missing permissions and foreign projects cannot be connected',async()=>{
 const {env,db}=await setup();try{
  for(const [options,code]of [[{callback:{object:'page',callback_url:'https://existing.example.test/hook'}},'app_callback_conflict'],[{tokenAppId:'987654'},'page_token_app_mismatch'],[{leadAccess:false},'meta_200']]){
   const state=graphSetup(env,options);await assert.rejects(connectDirectMeta(env,p,{pageId,appId}),{code});assert.equal(state.writes.length,0);assert.equal(db.prepare('SELECT subscribed FROM crm_pages').get().subscribed,0);
  }
  const state=graphSetup(env);await assert.rejects(connectDirectMeta(env,{id:'another-project'},{pageId,appId}),{code:'page_already_linked'});assert.equal(state.reads.length,0);
 }finally{db.close();}
});
test('subscription acknowledgements without readback do not claim that the page is connected',async()=>{
 const {env,db}=await setup();try{
  graphSetup(env);const fetch=env.CRM_FETCH;env.CRM_FETCH=(url,options)=>options.method==='POST'&&url.includes('/subscribed_apps')?Promise.resolve(Response.json({success:true})):fetch(url,options);
  await assert.rejects(connectDirectMeta(env,p,{pageId,appId}),{code:'subscription_not_confirmed'});assert.equal(db.prepare('SELECT subscribed FROM crm_pages').get().subscribed,0);
 }finally{db.close();}
});
test('signed webhook keeps form answers and contacts; attribution retry enriches the same card without losing its status',async()=>{
 const {env,db}=await setup();try{
  db.prepare("INSERT INTO integrations(id,project_id,provider,external_account_id,status) VALUES('direct-leads',?,'meta_ads','987','active')").run(p.id);
  const body=JSON.stringify({object:'page',entry:[{id:pageId,changes:[{field:'leadgen',value:{page_id:pageId,form_id:'777',leadgen_id:'888'}}]}]}),headers={'x-hub-signature-256':'sha256='+await signature(env.META_APP_SECRET,body)};
  for(let i=0;i<2;i++)assert.equal((await webhook(new Request(META_CALLBACK,{method:'POST',headers,body}),env)).status,200);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM crm_delivery WHERE kind='meta_lead'").get().n,1);
  let adReady=false;env.CRM_FETCH=async(url,options)=>{assert.ok(options.signal);if(url.includes('/888?'))return Response.json({id:'888',form_id:'777',ad_id:'111',campaign_id:'222',adset_id:'333',created_time:'2026-10-14T11:00:00Z',field_data:[{name:'full_name',values:['Synthetic lead']},{name:'phone_number',values:['+420123456789']},{name:'budget',values:['100000']}]});return adReady?Response.json({id:'111',account_id:'987'}):Response.json({error:{code:4}},{status:429});};
  await drain(env);let lead=db.prepare('SELECT * FROM leads').get();assert.equal(lead.name,'Synthetic lead');assert.equal(lead.phone,'+420123456789');assert.equal(JSON.parse(lead.metadata_json).formAnswers.length,3);assert.equal(db.prepare('SELECT state FROM crm_delivery').get().state,'error');
  await updateLead(env,p,lead.id,{status:'В работе',version:1},'synthetic','move-direct');adReady=true;db.prepare("UPDATE crm_delivery SET next_attempt_at='2000-01-01T00:00:00Z'").run();await drain(env);await drain(env);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,1);lead=db.prepare('SELECT * FROM leads').get();assert.equal(lead.current_status,'В работе');assert.equal(JSON.parse(lead.metadata_json).adAttribution.adId,'111');assert.equal(db.prepare('SELECT state FROM crm_delivery').get().state,'sent');
 }finally{db.close();}
});
test('exact historical Meta IDs reuse imported cards and preserve deletion; similar contacts with different IDs remain separate',async()=>{
 const {env,db}=await setup();try{
  const old=await ingest(env,p,{name:'Historical',phone:'+420111111111'},'legacy_project_sheet','888');db.prepare("UPDATE leads SET current_status='В работе',metadata_json=json_set(metadata_json,'$.leadgenId','888') WHERE id=?").run(old.id);
  const current=await ingest(env,p,{name:'Current',phone:'+420111111111',pageId},'meta_lead_ads','888');assert.equal(current.id,old.id);assert.equal(current.status,'В работе');assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,1);
  db.prepare("UPDATE leads SET deleted_at='2026-10-14T12:00:00Z' WHERE id=?").run(old.id);const retry=await ingest(env,p,{phone:'+420111111111'},'meta_lead_ads','888');assert.ok(retry.deletedAt);
  const other=await ingest(env,p,{phone:'+420111111111'},'meta_lead_ads','889');assert.notEqual(other.id,old.id);assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,2);
 }finally{db.close();}
});
test('webhook rejects wrong signatures and conflicting signed page/form identities',async()=>{
 const {env,db}=await setup();try{
  const make=async(page,form)=>{const body=JSON.stringify({object:'page',entry:[{id:pageId,changes:[{field:'leadgen',value:{page_id:page,form_id:form,leadgen_id:'888'}}]}]});return new Request(META_CALLBACK,{method:'POST',body,headers:{'x-hub-signature-256':'sha256='+await signature(env.META_APP_SECRET,body)}});};
  assert.equal((await webhook(await make('other','777'),env)).status,403);assert.equal(db.prepare('SELECT COUNT(*) n FROM crm_delivery').get().n,0);
  await webhook(await make(pageId,'777'),env);env.CRM_FETCH=async()=>Response.json({id:'888',form_id:'999',field_data:[{name:'email',values:['test@example.test']}]});await drain(env);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,0);assert.equal(db.prepare('SELECT last_error FROM crm_delivery').get().last_error,'lead_form_mismatch');
 }finally{db.close();}
});
test('direct Meta setup is master-only and does not expose app credentials',async()=>{
 const {env,db}=await setup(),worker=await testWorker();try{
  const url='/api/v2/projects/'+p.slug+'/crm/connections/direct-meta';assert.equal((await worker.fetch(request(url,{method:'POST',body:{pageId,appId},role:'viewer'}),env)).status,403);
  env.MVP_EDITOR_PROJECTS+=',__master';graphSetup(env);const response=await worker.fetch(request(url,{method:'POST',body:{pageId,appId}}),env),body=await response.text();assert.equal(response.status,200);assert.ok(!body.includes(env.META_APP_SECRET));assert.ok(!body.includes('synthetic-page-token'));
 }finally{db.close();}
});
test('an undiscovered Page ID is resolved through the agent, checked without writes, then persisted only on connect',async()=>{
 const {env,db}=await setup();try{
  db.prepare('DELETE FROM crm_pages').run();
  db.prepare('INSERT INTO crm_agent_credentials VALUES(?,?,?)').run('toys-media-buyer',await crypt(env,'synthetic-agent-token'),new Date().toISOString());
  const state=graphSetup(env),fetch=env.CRM_FETCH;
  env.CRM_FETCH=async(url,options)=>{
   const u=new URL(url);if(u.pathname==='/v26.0/'+pageId){assert.equal(options.headers.authorization,'Bearer synthetic-agent-token');assert.equal(u.searchParams.get('fields'),'id,name,access_token');return Response.json({id:pageId,name:'Synthetic page',access_token:'synthetic-resolved-page-token'});}
   if(u.pathname==='/v26.0/debug_token')assert.equal(u.searchParams.get('input_token'),'synthetic-resolved-page-token');
   return fetch(url,options);
  };
  const check=await connectDirectMeta(env,p,{pageId,appId,action:'check'});assert.equal(check.leadReadAccess,true);assert.equal(db.prepare('SELECT COUNT(*) n FROM crm_pages').get().n,0);assert.equal(state.writes.length,0);
  const connected=await connectDirectMeta(env,p,{pageId,appId,action:'connect'}),page=db.prepare('SELECT * FROM crm_pages').get();
  assert.equal(connected.state,'awaiting_lead');assert.equal(page.project_id,p.id);assert.equal(page.subscribed,1);assert.equal(await crypt(env,page.token_cipher,true),'synthetic-resolved-page-token');assert.ok(!JSON.stringify(connected).includes('token'));assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,0);
 }finally{db.close();}
});
test('targeted page lookup rejects missing tokens, incorrect identities and incorrect issuing apps before persisting or subscribing',async()=>{
 for(const [candidate,options,code]of [
  [{id:pageId},{},'page_token_missing'],
  [{id:'999',access_token:'synthetic-token'},{},'page_identity_mismatch'],
  [{id:pageId,access_token:'synthetic-token'},{tokenAppId:'999'},'page_token_app_mismatch'],
  [{id:pageId,access_token:'synthetic-token'},{leadAccess:false},'meta_200']
 ]){
  const {env,db}=await setup();try{
   db.prepare('DELETE FROM crm_pages').run();env.META_ADS_ACCESS_TOKEN='synthetic-agent-fallback';const state=graphSetup(env,options),fetch=env.CRM_FETCH;
   env.CRM_FETCH=(url,opts)=>new URL(url).pathname==='/v26.0/'+pageId?Promise.resolve(Response.json(candidate)):fetch(url,opts);
   await assert.rejects(connectDirectMeta(env,p,{pageId,appId}),{code});assert.equal(state.writes.length,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM crm_pages').get().n,0);
  }finally{db.close();}
 }
});
test('targeted page lookup does not replace a concurrent assignment to another project',async()=>{
 const {env,db}=await setup();try{
  db.prepare('DELETE FROM crm_pages').run();env.META_ADS_ACCESS_TOKEN='synthetic-agent-fallback';
  const other='prj_other';db.prepare("INSERT INTO projects(id,organization_id,slug,name,project_type,status,currency) VALUES(?,'org_toys_agency','other','Other','leadgen','active','EUR')").run(other);
  const state=graphSetup(env,{callback:{object:'page',callback_url:META_CALLBACK,active:true,fields:['leadgen']}}),fetch=env.CRM_FETCH;
  env.CRM_FETCH=async(url,opts)=>{
   if(new URL(url).pathname==='/v26.0/'+pageId){
    db.prepare('INSERT INTO crm_pages(page_id,name,project_id,discovered_at,updated_at) VALUES(?,?,?,?,?)').run(pageId,'Other project page',other,'2026-10-14','2026-10-14');
    return Response.json({id:pageId,access_token:'synthetic-token'});
   }return fetch(url,opts);
  };
  await assert.rejects(connectDirectMeta(env,p,{pageId,appId}),{code:'page_already_linked'});assert.equal(db.prepare('SELECT project_id FROM crm_pages').get().project_id,other);assert.equal(state.writes.length,0);
 }finally{db.close();}
});
test('saved setup identifiers are master-only suggestions and do not imply a subscription or lead delivery',async()=>{
 const {env,db}=await setup(),worker=await testWorker();try{
  db.prepare('UPDATE projects SET settings_json=json_set(settings_json,\'$.directMetaSetup\',json(?)) WHERE id=?').run(JSON.stringify({pageId,appId}),p.id);
  env.MVP_EDITOR_PROJECTS+=',__master';const url='/api/v2/projects/'+p.slug+'/crm/connections';
  const response=await worker.fetch(request(url),env),data=await response.json();assert.equal(response.status,200);assert.equal(data.directMeta.suggestedPageId,pageId);assert.equal(data.directMeta.suggestedAppId,appId);assert.equal(data.directMeta.lastDeliveredAt,null);assert.equal(data.pages[0].subscribed,0);
  assert.equal((await worker.fetch(request(url,{role:'viewer'}),env)).status,403);
 }finally{db.close();}
});
