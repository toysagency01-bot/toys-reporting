import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
import {enable,ingest,updateLead,summary,crypt,hash,project} from '../crm/service.js';
import {drain,capiPayload,webhook,signature} from '../crm/delivery.js';
const p={id:'prj_housevip_cxp7',slug:'housevip-cxp7',timezone:'Asia/Tbilisi'},today=new Date().toISOString().slice(0,10);
function setup(){const f=fixture();f.env.CRM_ENCRYPTION_KEY=btoa('x'.repeat(32));f.env.CRM_VERIFY_TOKEN='synthetic-verify';return f;}

test('Make intake keeps native Meta identity, rejects wrong page and key, deduplicates direct delivery and matches CAPI',async()=>{
 const {env,db}=setup();try{
 await enable(env,p);db.prepare('UPDATE crm_projects SET website_key_hash=?').run(await hash('synthetic-make-key'));
 const n=new Date().toISOString();db.prepare('INSERT INTO crm_pages(page_id,name,project_id,discovered_at,updated_at) VALUES(?,?,?,?,?)').run('123','Synthetic page',p.id,n,n);
 db.prepare("INSERT INTO integrations(id,project_id,provider,external_account_id,status) VALUES('meta-make',?,'meta_ads','987','active')").run(p.id);
 const body={leadgenId:'123456789012345678',pageId:'123',email:'make@example.test',createdAt:n,adAttribution:{provider:'meta_ads',accountId:'987',adId:'111',campaignId:'222',adsetId:'333'}};
 const url='https://test.local/api/crm/ingest/'+p.slug+'/meta-lead';
 const send=(data=body,key='synthetic-make-key')=>webhook(new Request(url,{method:'POST',headers:{authorization:'Bearer '+key},body:JSON.stringify(data)}),env);
 assert.equal((await send(body,'wrong-key')).status,401);
 assert.equal((await send({...body,pageId:'456'})).status,403);
 assert.equal((await send({...body,leadgenId:123456789012345678})).status,400);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,0);
 const result=await send();assert.equal(result.status,201);const {id}=await result.json();
 await updateLead(env,p,id,{status:'Квалифицирован',version:1},'synthetic','make-qualification');
 assert.equal((await (await send()).json()).id,id);
 assert.equal((await ingest(env,p,{...body,sourceAdId:'111'},'meta_lead_ads',body.leadgenId)).id,id);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,1);
 const lead=db.prepare('SELECT * FROM leads').get();assert.equal(lead.current_status,'Квалифицирован');assert.equal(lead.source_provider,'meta_lead_ads');
 const meta=JSON.parse(lead.metadata_json);assert.equal(meta.leadgenId,body.leadgenId);assert.equal(meta.adAttribution.adId,'111');
 assert.equal((await summary(env,p,'2026-01-01','2099-12-31')).byAd[0].qualified,1);
 db.prepare("UPDATE crm_projects SET dataset_id='123456',capi_token_cipher=?,capi_enabled=1").run(await crypt(env,'synthetic-capi-token'));
 let calls=0;env.CRM_FETCH=async(url,options)=>{calls++;const event=JSON.parse(options.body.get('data'))[0];assert.equal(event.user_data.lead_id,body.leadgenId);assert.equal(event.event_name,'QualifiedLead');return Response.json({events_received:1});};
 await drain(env);await drain(env);assert.equal(calls,1);assert.equal(db.prepare('SELECT state FROM crm_delivery').get().state,'sent');
 }finally{db.close();}
});

test('draft projects allow private CRM setup without activating or publishing their dashboard',async()=>{
 const {env,db}=setup();try{
 db.prepare("UPDATE projects SET status='draft' WHERE id=?").run(p.id);
 const draft=await project(env,p.slug);assert.equal(draft.status,'draft');await enable(env,draft);
 assert.equal(db.prepare('SELECT status FROM projects WHERE id=?').get(p.id).status,'draft');
 }finally{db.close();}
});

test('CRM sources deduplicate retries; status CAS and milestones count each lead once, with exact currency separation',async()=>{
 const {env,db}=setup();try{await enable(env,p);const data={name:'Synthetic',phone:'+420123456789',email:'synthetic@example.test'};const lead=await ingest(env,p,data,'website','submission-1');assert.equal((await ingest(env,p,data,'website','submission-1')).id,lead.id);assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,1);
 const qualified={status:'Квалифицирован',version:1,note:'Checked'};await updateLead(env,p,lead.id,qualified,'synthetic','q1');assert.equal((await updateLead(env,p,lead.id,qualified,'synthetic','q1')).version,2);
 await assert.rejects(updateLead(env,p,lead.id,{status:'Потерян',version:1},'synthetic','stale'),{code:'version_conflict'});
 await updateLead(env,p,lead.id,{status:'В работе',version:2},'synthetic','back');await updateLead(env,p,lead.id,{status:'Квалифицирован',version:3},'synthetic','q2');
 await assert.rejects(updateLead(env,p,lead.id,{status:'Продажа',version:4},'synthetic','bad-sale'),{code:'sale_value_currency_required'});
 await updateLead(env,p,lead.id,{status:'Продажа',version:4,value:'125.50',currency:'EUR'},'synthetic','sale');
 const sums=await summary(env,p,'2026-01-01','2099-12-31');assert.equal(sums.qualified,1);assert.equal(sums.sales,1);assert.deepEqual(sums.revenue,[{currency:'EUR',value:125.5}]);assert.equal(db.prepare('SELECT COUNT(*) n FROM crm_delivery').get().n,2);
 }finally{db.close();}
});

test('CAPI delivery uses stable event IDs, hashes contacts, requires Meta acknowledgement and never repeats sent jobs',async()=>{
 const {env,db}=setup();try{await enable(env,p);const lead=await ingest(env,p,{email:'TEST@EXAMPLE.TEST',phone:'+420 123 456 789'},'meta_lead_ads','123456789');await updateLead(env,p,lead.id,{status:'Квалифицирован',version:1},'synthetic','q');
 await drain(env);assert.equal(db.prepare('SELECT state FROM crm_delivery').get().state,'blocked');
 const token=await crypt(env,'synthetic-meta-token');assert.equal(await crypt(env,token,true),'synthetic-meta-token');assert.ok(!token.includes('synthetic-meta'));
 db.prepare("UPDATE crm_projects SET dataset_id='123456',capi_token_cipher=?,capi_enabled=1").run(token);db.prepare("UPDATE crm_delivery SET state='pending',next_attempt_at='2000-01-01T00:00:00Z'").run();let calls=0;
 env.CRM_FETCH=async(url,options)=>{calls++;assert.equal(url,'https://graph.facebook.com/v26.0/123456/events');const event=JSON.parse(options.body.get('data'))[0];assert.equal(event.event_name,'QualifiedLead');assert.equal(event.user_data.lead_id,'123456789');assert.equal(event.user_data.em[0],await hash('test@example.test'));assert.equal(event.user_data.ph[0],await hash('420123456789'));assert.ok(!JSON.stringify(event).includes('TEST@'));return Response.json({events_received:1});};
 await drain(env);await drain(env);assert.equal(calls,1);assert.equal(db.prepare('SELECT state FROM crm_delivery').get().state,'sent');
 }finally{db.close();}
});

test('website intake rejects missing credentials; Meta signature and page scope guard the durable inbox',async()=>{
 const {env,db}=setup();try{await enable(env,p);await env.TOYS_DB.prepare('UPDATE crm_projects SET website_key_hash=?').bind(await hash('synthetic-website')).run();
 const url='https://test.local/api/crm/ingest/'+p.slug+'/website',body=JSON.stringify({submissionId:'web-1',email:'synthetic@example.test'});
 assert.equal((await webhook(new Request(url,{method:'POST',body}),env)).status,401);
 assert.equal((await webhook(new Request(url,{method:'POST',body,headers:{authorization:'Bearer synthetic-website'}}),env)).status,201);
 const n=new Date().toISOString();db.prepare('INSERT INTO crm_pages(page_id,name,project_id,discovered_at,updated_at) VALUES(?,?,?,?,?)').run('123','Synthetic',p.id,n,n);env.META_APP_SECRET='synthetic-app-secret';
 const raw=JSON.stringify({object:'page',entry:[{id:'123',changes:[{field:'leadgen',value:{leadgen_id:'456'}}]}]});const meta='https://test.local/api/crm/ingest/'+p.slug+'/meta';
 assert.equal((await webhook(new Request(meta,{method:'POST',body:raw}),env)).status,401);
 const headers={'x-hub-signature-256':'sha256='+await signature(env.META_APP_SECRET,raw)};
 assert.equal((await webhook(new Request(meta,{method:'POST',body:raw,headers}),env)).status,200);await webhook(new Request(meta,{method:'POST',body:raw,headers}),env);assert.equal(db.prepare("SELECT COUNT(*) n FROM crm_delivery WHERE kind='meta_lead'").get().n,1);
 }finally{db.close();}
});

test('CRM and master are never public; clients manage only their own leads without agency settings',async()=>{
 const worker=await testWorker();const {env,db}=setup();try{const base='/api/v2/projects/'+p.slug+'/crm';
 assert.equal((await worker.fetch(request(base,{role:null}),env)).status,401);
 assert.equal((await worker.fetch(request(base+'/connections',{role:'viewer'}),env)).status,403);
 assert.equal((await worker.fetch(request('/api/v2/projects/'+p.slug+'/content-crm',{role:null}),env)).status,401);
 assert.equal((await worker.fetch(request('/api/v2/projects/'+p.slug+'/content-crm',{role:'viewer'}),env)).status,200);
 assert.equal((await worker.fetch(request('/api/v2/master',{role:'viewer'}),env)).status,403);
 assert.equal((await worker.fetch(request('/api/v2/projects/other/crm'),env)).status,403);
 const created=await worker.fetch(request(base,{method:'POST',body:{email:'synthetic@example.test'}}),env);assert.equal(created.status,201);const lead=(await created.json()).lead;
 assert.equal((await worker.fetch(request(base+'/leads/'+lead.id,{method:'PATCH',role:'viewer',body:{status:'В работе',version:1}}),env)).status,200);
 const viewer=await worker.fetch(request(base,{role:'viewer'}),env);assert.equal((await viewer.json()).leads[0].id,lead.id);
 env.MVP_EDITOR_PROJECTS+=',__master';assert.equal((await worker.fetch(request('/api/v2/master'),env)).status,200);
 assert.equal((await worker.fetch(request('/api/v2/master/view'),env)).status,200);
 }finally{db.close();}
});

test('messaging architecture verifies signatures, deduplicates contacts and keeps conversations inside the project',async()=>{
 const {messageWebhook}=await import('../crm/messages.js');const{env,db}=setup();try{
 env.META_APP_SECRET='synthetic-app-secret';const n=new Date().toISOString();db.prepare('INSERT INTO crm_channels(provider,external_id,name,project_id,discovered_at,updated_at) VALUES(?,?,?,?,?,?)').run('instagram','123','Synthetic IG',p.id,n,n);
 const raw=JSON.stringify({object:'instagram',entry:[{id:'123',messaging:[{sender:{id:'999'},message:{mid:'msg1',text:'Hello'},timestamp:Date.now()}]}]});const url='https://test.local/api/crm/messages';
 assert.equal((await messageWebhook(new Request(url,{method:'POST',body:raw}),env)).status,401);
 const headers={'x-hub-signature-256':'sha256='+await signature(env.META_APP_SECRET,raw)};
 assert.equal((await messageWebhook(new Request(url,{method:'POST',body:raw,headers}),env)).status,200);
 assert.equal((await messageWebhook(new Request(url,{method:'POST',body:raw,headers}),env)).status,200);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM crm_messages').get().n,1);
 const lead=db.prepare('SELECT * FROM leads').get();assert.equal(lead.project_id,p.id);assert.equal(lead.source_provider,'instagram');
 const worker=await testWorker();const response=await worker.fetch(request('/api/v2/projects/'+p.slug+'/crm/leads/'+lead.id,{role:'viewer'}),env);assert.equal((await response.json()).messages[0].text,'Hello');
 assert.equal((await worker.fetch(request('/api/v2/projects/other/crm/leads/'+lead.id,{role:'viewer'}),env)).status,403);
 }finally{db.close();}
});
