import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
import {projectPipeline} from '../crm/pipelines.js';
import {enable,ingest,updateLead,deleteLead,listLeads,summary,crypt} from '../crm/service.js';
import {drain} from '../crm/delivery.js';
const p={id:'prj_housevip_cxp7',slug:'housevip-cxp7',timezone:'Asia/Tbilisi'};
const expected=['Новый','Не удалось связаться','Связались','Квалифицирован','Подбор объекта','Просмотр назначен','Просмотр проведён','Переговоры','Бронь / задаток','Сделка','Отказ','Отложен','Неактуален'];
const board=(env,query='')=>listLeads(env,p,new URL('https://test.local/?view=board&'+query));

test('TOYS pipeline preserves existing leads, initializes new ones in Новые and emits qualification only once',async()=>{
 const {env,db}=fixture();try{
  await enable(env,p);db.prepare("UPDATE crm_projects SET capi_kinds='qualified'").run();
  const old=await ingest(env,p,{name:'Existing',phone:'+995555010000'},'meta_lead_ads','123456');
  db.prepare("UPDATE projects SET settings_json=json_set(settings_json,'$.crmTemplate','toys_agency') WHERE id=?").run(p.id);
  const labels=['Новые','Первичный контакт','Фолоу ап 1','Фолоу ап 2','Вышел на связь','Квалифицирован','Кикоф митинг','Готовим КП аудит','Презентовали КП','Согласование договора','Отложенные (перспективные)','Отложенные (малоперспективные)','Нет ответа, без номера, мусор','Успешно реализовано','Закрыто, но не реализовано'];
  let d=await board(env);assert.deepEqual(d.statuses,labels);assert.equal(d.total,1);assert.equal(d.columns[0].leads[0].id,old.id);assert.equal(d.columns[0].leads[0].status,'Новые');
  assert.equal((await board(env,'status='+encodeURIComponent('Новые'))).total,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM crm_milestones').get().n,0);
  const fresh=await ingest(env,p,{email:'new@example.test'},'manual','new');assert.equal(fresh.status,'Новые');
  let version=1;
  for(const status of labels.slice(1,10)){
   await updateLead(env,p,old.id,{status,version:version++},'owner','toys-'+version);
   d=await board(env);assert.equal(d.columns.find(c=>c.status===status).total,1);
   assert.equal(d.summary.qualified,labels.indexOf(status)>=5?1:0);
  }
  assert.equal(db.prepare("SELECT COUNT(*) n FROM crm_milestones WHERE kind='qualified'").get().n,1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM crm_delivery WHERE kind='capi'").get().n,1);
  await assert.rejects(updateLead(env,p,old.id,{status:'Успешно реализовано',version},'owner','toys-missing-amount'),{code:'sale_value_currency_required'});
  await updateLead(env,p,old.id,{status:'Успешно реализовано',version:version++,value:'1500',currency:'EUR'},'owner','toys-won');
  d=await board(env);assert.equal(d.summary.qualified,1);assert.equal(d.summary.sales,1);assert.equal(d.summary.revenue[0].value,1500);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM crm_delivery WHERE kind='capi'").get().n,1,'TOYS sales are statistics only; qualification CAPI stays deduplicated');
  await ingest(env,p,{name:'Replayed',phone:'+995555010000'},'meta_lead_ads','123456');
  assert.equal((await board(env)).summary.sales,1,'provider retries preserve the chosen stage');
  await updateLead(env,p,old.id,{status:'Закрыто, но не реализовано',version},'owner','toys-lost');
  assert.deepEqual((await board(env)).summary,{qualified:0,sales:0,revenue:[]});
  db.prepare("INSERT INTO projects(id,organization_id,slug,name,settings_json) VALUES('other-project','org_toys_agency','other-project','Other','{}')").run();
  assert.equal((await projectPipeline(env,{id:'other-project'})).key,'general');
 }finally{db.close();}
});

test('TOYS qualification allowlist covers direct entry, rejection, re-entry and retry-safe Meta delivery',async()=>{
 const qualifying=['Квалифицирован','Кикоф митинг','Готовим КП аудит','Презентовали КП','Согласование договора','Успешно реализовано'];
 const excluded=['Новые','Первичный контакт','Фолоу ап 1','Фолоу ап 2','Вышел на связь','Отложенные (перспективные)','Отложенные (малоперспективные)','Нет ответа, без номера, мусор','Закрыто, но не реализовано'];
 const {env,db}=fixture();try{
  await enable(env,p);db.prepare("UPDATE projects SET settings_json=json_set(settings_json,'$.crmTemplate','toys_agency') WHERE id=?").run(p.id);
  env.CRM_ENCRYPTION_KEY=btoa('x'.repeat(32));
  db.prepare("UPDATE crm_projects SET capi_kinds='qualified',capi_enabled=1,dataset_id='1036998279992732',capi_token_cipher=?").run(await crypt(env,'synthetic-token'));
  const sent=[];env.CRM_FETCH=async(url,options)=>{
   assert.equal(url,'https://graph.facebook.com/v26.0/1036998279992732/events');
   const [event]=JSON.parse(new URLSearchParams(options.body).get('data'));sent.push(event);
   return Response.json({events_received:sent.length===1?0:1});
  };
  // Each explicit non-qualifying stage can be reached directly without producing an event.
  for(const [i,status] of excluded.entries()){
   const lead=await ingest(env,p,{phone:'+995555010010'},'meta_lead_ads',String(10000+i));
   await updateLead(env,p,lead.id,{status,version:1},'owner','exclude-'+i);
   assert.equal((await board(env)).summary.qualified,0,status);
   assert.equal(db.prepare('SELECT count(*) n FROM crm_milestones').get().n,0,status);
  }
  for(const [i,status] of qualifying.entries()){
   const lead=await ingest(env,p,{phone:'+995555010020'},'meta_lead_ads',String(20000+i));
   let version=1;
   const move=async(status)=>updateLead(env,p,lead.id,{status,version:version++,...(status==='Успешно реализовано'?{value:'500',currency:'EUR'}:{})},'owner','qual-'+i+'-'+version);
   await move(status);
   assert.equal((await board(env)).summary.qualified,i+1,'direct entry '+status);
   const filtered=await board(env,'status='+encodeURIComponent(status));assert.equal(filtered.summary.qualified,1);
   const milestone=db.prepare("SELECT id,occurred_at FROM crm_milestones WHERE lead_id=? AND kind='qualified'").get(lead.id);
   assert.ok(milestone);
   for(const other of excluded){
    await move(other);assert.equal((await board(env)).summary.qualified,i,'leave to '+other);
    await move(status);assert.equal((await board(env)).summary.qualified,i+1,'return from '+other);
   }
   assert.deepEqual(db.prepare("SELECT id,occurred_at FROM crm_milestones WHERE lead_id=? AND kind='qualified'").get(lead.id),milestone);
   assert.equal(db.prepare("SELECT count(*) n FROM crm_delivery WHERE lead_id=? AND kind='capi'").get(lead.id).n,1);
  }
  assert.equal((await board(env)).summary.sales,1);
  await drain(env);
  assert.equal(sent.length,6);assert.ok(sent.every(e=>e.event_name==='QualifiedLead'&&e.user_data.lead_id&&e.custom_data.value===undefined));
  assert.equal(db.prepare("SELECT count(*) n FROM crm_delivery WHERE state='error'").get().n,1);
  db.prepare("UPDATE crm_delivery SET next_attempt_at='2000-01-01T00:00:00Z' WHERE state='error'").run();await drain(env);
  assert.equal(sent.length,7);assert.deepEqual(sent[6],sent[0],'retry preserves event identity, time and lead');
  await drain(env);assert.equal(sent.length,7,'acknowledged events are not resent');
  assert.equal(db.prepare("SELECT count(*) n FROM crm_delivery WHERE state='sent'").get().n,6);
  const totals=await summary(env,p,'2026-01-01','2099-01-01');assert.equal(totals.qualified,6);assert.equal(totals.sales,1);
 }finally{db.close();}
});

test('real-estate niche supplies all requested stages for any project and keeps existing leads visible',async()=>{
 const {env,db}=fixture();try{
  await enable(env,p);const lead=await ingest(env,p,{name:'Existing lead',phone:'+995555010000'},'manual','old');
  await updateLead(env,p,lead.id,{status:'В работе',version:1},'owner','work');
  db.prepare("UPDATE projects SET settings_json=json_set(settings_json,'$.industry','real_estate') WHERE id=?").run(p.id);
  let d=await board(env);assert.deepEqual(d.statuses,expected);assert.equal(d.columns.length,13);assert.equal(d.total,1);assert.equal(d.columns[2].leads[0].status,'Связались');assert.equal(d.columns[2].leads[0].version,2);
  const filtered=await board(env,'status='+encodeURIComponent('Связались'));assert.equal(filtered.total,1);assert.equal(filtered.columns.length,1);
  const paged=await listLeads(env,p,new URL('https://test.local/?status='+encodeURIComponent('Связались')));assert.equal(paged.leads[0].status,'Связались');
  await assert.rejects(updateLead(env,p,lead.id,{status:'В работе',version:2},'owner','obsolete-stage'),{code:'invalid_status_or_version'});
  let version=2;
  for(const status of expected.slice(3,9)){await updateLead(env,p,lead.id,{status,version:version++},'owner','stage-'+version);d=await board(env);assert.equal(d.summary.qualified,1);assert.equal(d.summary.sales,0);}
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM crm_milestones WHERE kind='qualified'").get().n,1);
  await assert.rejects(updateLead(env,p,lead.id,{status:'Сделка',version},'owner','bad-sale'),{code:'sale_value_currency_required'});
  await updateLead(env,p,lead.id,{status:'Сделка',version:version++,value:'200000',currency:'EUR'},'owner','sale');d=await board(env);assert.equal(d.summary.sales,1);assert.equal(d.summary.qualified,0);assert.equal(d.summary.revenue[0].value,200000);
  await updateLead(env,p,lead.id,{status:'Отказ',version},'owner','rejected');d=await board(env);assert.deepEqual(d.summary,{qualified:0,sales:0,revenue:[]});
  db.prepare("INSERT INTO projects(id,organization_id,slug,name,settings_json) VALUES('future-estate','org_toys_agency','future-estate','Future estate','{\"industry\":\"real_estate\"}')").run();
  assert.deepEqual((await projectPipeline(env,{id:'future-estate'})).stages.map(s=>s.label),expected);
  db.prepare("UPDATE projects SET settings_json='{}' WHERE id='future-estate'").run();assert.equal((await projectPipeline(env,{id:'future-estate'})).key,'general');
 }finally{db.close();}
});

test('legacy sale, refusal and lost labels map consistently to real estate totals and filtered pages',async()=>{
 const {env,db}=fixture();try{
  await enable(env,p);
  for(const [i,status] of ['Продажа','Не подходит','Потерян'].entries()){
   const lead=await ingest(env,p,{email:'legacy'+i+'@example.test'},'manual','legacy'+i);
   await updateLead(env,p,lead.id,{status,version:1,...(i===0?{value:'123.45',currency:'EUR'}:{})},'owner','legacy'+i);
  }
  db.prepare("UPDATE projects SET settings_json='{\"crmTemplate\":\"real_estate\"}' WHERE id=?").run(p.id);
  const d=await board(env);assert.equal(d.total,3);assert.equal(d.columns[9].total,1);assert.equal(d.columns[10].total,1);assert.equal(d.columns[12].total,1);assert.equal(d.summary.revenue[0].value,123.45);
 }finally{db.close();}
});

test('deletion is versioned and idempotent, excludes CRM metrics and cannot be reversed by provider retries',async()=>{
 const {env,db}=fixture();try{
  await enable(env,p);const input={name:'Delete contact',email:'delete@example.test'},lead=await ingest(env,p,input,'meta_lead_ads','123456');
  await updateLead(env,p,lead.id,{status:'Квалифицирован',version:1},'owner','qualified');await updateLead(env,p,lead.id,{status:'Продажа',version:2,value:'300',currency:'EUR'},'owner','sold');
  await assert.rejects(deleteLead(env,p,lead.id,{version:2},'owner','stale'),{code:'version_conflict'});assert.equal((await board(env)).total,1);
  const deleted=await deleteLead(env,p,lead.id,{version:3},'owner','delete');assert.deepEqual(await deleteLead(env,p,lead.id,{version:3},'owner','delete'),deleted);
  assert.deepEqual((await board(env)).summary,{qualified:0,sales:0,revenue:[]});assert.equal((await board(env)).total,0);
  const sums=await summary(env,p,'2026-01-01','2099-01-01');assert.equal(sums.qualified,0);assert.equal(sums.sales,0);assert.deepEqual(sums.byAd,[]);
  assert.equal((await listLeads(env,p,new URL('https://test.local/'))).leads.length,0);
  const replay=await ingest(env,p,input,'meta_lead_ads','123456');assert.equal(replay.id,lead.id);assert.ok(replay.deletedAt);assert.equal((await board(env)).total,0);
  await assert.rejects(updateLead(env,p,lead.id,{status:'Новый',version:4},'owner','revive'),{code:'not_found'});
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='crm.lead.deleted'").get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM crm_milestones').get().n,2);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM crm_delivery WHERE state='blocked' AND last_error='lead_deleted'").get().n,2);
  env.CRM_ENCRYPTION_KEY=btoa('x'.repeat(32));db.prepare("UPDATE crm_projects SET dataset_id='123456',capi_enabled=1,capi_token_cipher=?").run(await crypt(env,'synthetic-token'));
  db.prepare("UPDATE crm_delivery SET state='pending',next_attempt_at='2000-01-01T00:00:00Z'").run();let sent=0;env.CRM_FETCH=async()=>{sent++;return Response.json({events_received:1});};await drain(env);assert.equal(sent,0);
 }finally{db.close();}
});

test('deletion loses a concurrent version race without hiding the lead or recording a successful audit',async()=>{
 const {env,db}=fixture();try{
  await enable(env,p);const lead=await ingest(env,p,{email:'race@example.test'},'manual','race');const batch=env.TOYS_DB.batch.bind(env.TOYS_DB);
  env.TOYS_DB.batch=async statements=>{db.prepare('UPDATE crm_lead_state SET version=version+1 WHERE lead_id=?').run(lead.id);return batch(statements);};
  await assert.rejects(deleteLead(env,p,lead.id,{version:1},'owner','race'),{code:'version_conflict'});
  assert.equal((await board(env)).total,1);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='crm.lead.deleted'").get().n,0);
 }finally{db.close();}
});

test('deletion is project scoped, rejects public access and blocks read/edit access after deletion',async()=>{
 const worker=await testWorker(),{env,db}=fixture();try{
  await enable(env,p);const lead=await ingest(env,p,{email:'scope@example.test'},'manual','scope'),url='/api/v2/projects/'+p.slug+'/crm/leads/'+lead.id;
  const remove=(role,path=url)=>worker.fetch(request(path,{method:'DELETE',body:{version:1},role,key:'delete-api'}),env);
  assert.equal((await remove(null)).status,401);assert.equal((await remove('viewer',url.replace(p.slug,'other-project'))).status,403);assert.equal((await board(env)).total,1);
  assert.equal((await remove('viewer')).status,200);assert.equal((await remove('viewer')).status,200);
  assert.equal((await worker.fetch(request(url,{role:'viewer'}),env)).status,404);
  assert.equal((await worker.fetch(request(url,{method:'PATCH',body:{status:'Новый',version:2}}),env)).status,404);
 }finally{db.close();}
});
