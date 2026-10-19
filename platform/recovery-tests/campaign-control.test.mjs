import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,request} from './fixture.mjs';
import {campaignControlAPI,controlCampaign,metaCampaignClient} from '../native/campaign-control.js';
import {campaignKey} from '../native/campaign-model.js';
import {auditHistory} from '../master/audit-service.js';
const p={id:'prj_housevip_cxp7',slug:'housevip-cxp7',organizationId:'org_toys_agency',name:'HOUSEVIP'};
const ref={integrationId:'int',accountId:'123',campaignId:'456',key:campaignKey(p.id,'meta_ads','int',['456']),name:'Synthetic campaign'};
const auth={ok:true,platformRole:'team',subject:'employee@example.test',projectSlugs:[p.slug]};
const body={status:'PAUSED',expectedStatus:'ACTIVE'};
const range={from:'2026-10-07',to:'2026-10-07'},qs='?'+new URLSearchParams(range),path='/api/v2/projects/'+p.slug+'/campaign-browser/'+ref.key+'/status'+qs;
function setup(){const f=fixture();Object.assign(f.env,{META_ADS_ACCESS_TOKEN:'synthetic-token-never-real',META_APP_SECRET:'synthetic-secret'});f.db.exec(`INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES('int','${p.id}','meta_ads','123','active','{}')`);return f;}
const client=(changes={})=>({read:async()=>({name:ref.name,status:'ACTIVE',effectiveStatus:'ACTIVE',checkedAt:new Date().toISOString()}),write:async()=>{},...changes});
const dependencies=(a=auth,fetchImpl)=>({authorizeMvp:async()=>a,projectRecord:async()=>p,fetchImpl,onDemandAdsService:()=>({getStats:async()=>({providers:[{provider:'meta_ads',integrationId:'int',requestedRange:range,coveredDates:[range.from],hierarchy:{providerId:'123',children:[{providerId:'456',level:'campaign',name:ref.name,dailyMetrics:[{date:range.from}],children:[]}]}}]})})});
const req=(options={})=>{const r=request(path,options);r.headers.set('origin','https://test.local');return r;};

test('a scoped Meta campaign can be paused and enabled; successful duplicate requests do not write twice',async()=>{
 const {env,db}=setup();let status='ACTIVE',writes=0;
 const c=client({read:async()=>({name:ref.name,status}),write:async next=>{writes++;status=next;}});
 try{
  const args={env,project:p,ref,auth,body,key:'change-one',client:c};
  assert.equal((await controlCampaign(args)).operation.state,'succeeded');assert.equal(status,'PAUSED');
  assert.equal((await controlCampaign(args)).operation.state,'succeeded');assert.equal(writes,1);
  await assert.rejects(controlCampaign({...args,body:{status:'ACTIVE',expectedStatus:'PAUSED'}}),{code:'idempotency_conflict'});
  assert.equal((await controlCampaign({...args,key:'change-two',body:{status:'ACTIVE',expectedStatus:'PAUSED'}})).operation.state,'succeeded');assert.equal(writes,2);
  const audit=await auditHistory(env.TOYS_DB,new URLSearchParams({category:'campaigns',actor:'employee@example.test'}));assert.equal(audit.events.length,2);assert.equal(audit.events[0].actor,auth.subject);assert.ok(audit.events.every(e=>e.after.state==='succeeded'));
 }finally{db.close();}
});
test('stale status, unsupported states and read failures never issue a provider write',async()=>{
 const {env,db}=setup();let writes=0;
 try{for(const [name,reader] of [['stale',async()=>({status:'PAUSED'})],['archived',async()=>({status:'ARCHIVED'})],['permission',async()=>{throw Object.assign(Error(),{code:'meta_permission_denied'});} ]]){
  const result=await controlCampaign({env,project:p,ref,auth,body,key:'reject-'+name,client:client({read:reader,write:async()=>writes++})});assert.equal(result.operation.state,'rejected');
 }assert.equal(writes,0);}finally{db.close();}
});
test('concurrent commands and ambiguous timeouts cannot trigger duplicate or opposite mutations',async()=>{
 const {env,db}=setup();let resolveRead,writes=0;const reading=new Promise(r=>resolveRead=r);
 try{
  const args={env,project:p,ref,auth,body,key:'parallel-one',client:client({read:()=>reading,write:async()=>{writes++;throw Error('timeout with secret that must not be logged');}})};
  const first=controlCampaign(args);await new Promise(r=>setTimeout(r,5));
  await assert.rejects(controlCampaign({...args,key:'parallel-two'}),{code:'campaign_change_in_progress'});
  resolveRead({status:'ACTIVE',name:ref.name});const r=await first;assert.equal(r.operation.state,'uncertain');assert.equal(writes,1);
  await controlCampaign(args);assert.equal(writes,1);
  await assert.rejects(controlCampaign({...args,key:'parallel-three'}),{code:'campaign_change_in_progress'});
  assert.ok(!JSON.stringify(db.prepare('SELECT * FROM campaign_operations').all()).includes('secret that'));
  db.prepare("UPDATE campaign_operations SET updated_at='2026-01-01T00:00:00Z'").run();
  const response=await campaignControlAPI(req(),env,{},dependencies(auth,async()=>Response.json({id:'456',account_id:'123',status:'PAUSED',effective_status:'PAUSED',name:ref.name})));
  const result=await response.json();assert.equal(response.status,200);assert.equal(result.operation.state,'succeeded');assert.equal(result.canChange,true);assert.equal(writes,1);
 }finally{db.close();}
});
test('client, public, unassigned team, cross-origin requests and foreign identities cannot change campaigns',async()=>{
 const {env,db}=setup();let requests=0;const provider=async()=>{requests++;return Response.json({id:'456',account_id:'999',status:'ACTIVE'});};
 try{
  for(const a of [{...auth,platformRole:'client'},{ok:true,role:'viewer'},{...auth,projectSlugs:[]}]){
   const r=await campaignControlAPI(req({method:'POST',body}),env,{},dependencies(a,provider));assert.equal(r.status,403);
  }
  const cross=req({method:'POST',body});cross.headers.set('origin','https://evil.invalid');assert.equal((await campaignControlAPI(cross,env,{},dependencies(auth,provider))).status,403);assert.equal(requests,0);
  const unknown=request(path.replace(ref.key,'a'.repeat(64)));assert.equal((await campaignControlAPI(unknown,env,{},dependencies(auth,provider))).status,409);assert.equal(requests,0);
  const mismatch=await campaignControlAPI(req({method:'POST',body}),env,{},dependencies(auth,provider));assert.equal((await mismatch.json()).operation.state,'rejected');assert.equal(requests,1);
  db.prepare("UPDATE integrations SET external_account_id='888' WHERE id='int'").run();assert.equal((await campaignControlAPI(req(),env,{},dependencies(auth,provider))).status,409);assert.equal(requests,1);
 }finally{db.close();}
});
test('Meta adapter uses fixed campaign endpoint and status-only body, and blocks redirects',async()=>{
 const env={META_ADS_ACCESS_TOKEN:'synthetic-token',META_APP_SECRET:'synthetic-secret'},seen=[];
 const c=metaCampaignClient(env,{config_json:'{}'},'123','456',async(url,options)=>{const request=new Request(url,options);seen.push(request);return request.method==='GET'?Response.json({id:'456',account_id:'123',status:'ACTIVE'}):Response.json({success:true});});
 await c.read();await c.write('PAUSED');assert.equal(seen[0].redirect,'manual');assert.equal(new URL(seen[0].url).host,'graph.facebook.com');assert.equal(seen[1].headers.get('authorization'),'Bearer synthetic-token');assert.deepEqual([...(await seen[1].formData()).keys()].sort(),['appsecret_proof','status']);
 const redirected=metaCampaignClient(env,{config_json:'{}'},'123','456',async()=>new Response(null,{status:302,headers:{location:'https://evil.invalid'}}));await assert.rejects(redirected.read(),{code:'meta_unavailable'});
});
test('admin history resolves authors, filters/paginates events and excludes credential fields',async()=>{
 const {env,db}=setup();try{
  db.exec("INSERT INTO users(id,email,display_name,status) VALUES('employee','employee@example.test','Сотрудник','active')");
  for(let i=0;i<55;i++)db.prepare("INSERT INTO audit_log(action,entity_type,entity_id,before_json,after_json,created_at) VALUES('client_access_updated','user','employee',?,?,?)").run(JSON.stringify({role:'client',password:'NEVER_EXPOSE'}),JSON.stringify({actor:'password:employee',role:'team',token:'NEVER_EXPOSE'}),'2026-10-19T'+String(i%20).padStart(2,'0')+':00:00Z');
  const list=await auditHistory(env.TOYS_DB,new URLSearchParams({actor:'Сотрудник',category:'access'}));assert.equal(list.events.length,50);assert.equal(list.nextOffset,50);assert.equal(list.events[0].actor,'employee@example.test');assert.ok(!JSON.stringify(list).includes('NEVER_EXPOSE'));
  const next=await auditHistory(env.TOYS_DB,new URLSearchParams({offset:'50',category:'access'}));assert.equal(next.events.length,5);assert.equal(next.nextOffset,null);
  const detail=await auditHistory(env.TOYS_DB,new URLSearchParams({event:list.events[0].id}));assert.equal(detail.event.before.role,'client');assert.equal(detail.event.after.role,'team');assert.ok(!JSON.stringify(detail).includes('NEVER_EXPOSE'));
  assert.equal((await auditHistory(env.TOYS_DB,new URLSearchParams({project:p.slug,category:'access'}))).events.length,0);
  await assert.rejects(auditHistory(env.TOYS_DB,new URLSearchParams({from:'2026-02-30'})),{code:'invalid_audit_filter'});
  const revisions=await auditHistory(env.TOYS_DB,new URLSearchParams({category:'reports'}));assert.ok(revisions.events.length>0);
  const rev=revisions.events.find(e=>e.action==='report.saved');const content=await auditHistory(env.TOYS_DB,new URLSearchParams({event:rev.id}));assert.ok(Object.keys(content.event.after.content).length);
 }finally{db.close();}
});
