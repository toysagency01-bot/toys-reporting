import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
import {enable,updateLead,summary} from '../crm/service.js';
import {capiPayload} from '../crm/delivery.js';
import {attachCRMQualification,aggregateQualifiedLeads} from '../native/crm-attribution.js';
const p={id:'prj_housevip_cxp7',slug:'housevip-cxp7'},intake={from:'2026-10-10',to:'2026-10-10'},qualified={from:'2026-10-21',to:'2026-10-21'};
function insert(db,id,createdAt,provider='meta_ads',accountId='123'){
 db.prepare("INSERT INTO leads(id,project_id,source_provider,external_lead_id,created_at,name,current_status,metadata_json) VALUES(?,?,'manual',?,?,'Synthetic cohort lead','Новый',?)").run(id,p.id,id,createdAt,JSON.stringify({adAttribution:{version:1,provider,accountId,adId:'111'}}));
}
async function qualify(env,db,id){await updateLead(env,p,id,{status:'Квалифицирован',version:0},'synthetic','qualify-'+id);db.prepare("UPDATE crm_milestones SET occurred_at='2026-10-21T09:00:00Z' WHERE lead_id=?").run(id);}
const result=(env,range,provider)=>summary(env,p,range.from,range.to,provider);
test('late qualification belongs to the intake cohort; sales keep event dates and CAPI facts are immutable',async()=>{
 const {env,db}=fixture();try{
  await enable(env,p);insert(db,'late','2026-10-10T09:00:00Z');await qualify(env,db,'late');
  await updateLead(env,p,'late',{status:'В работе',version:1},'synthetic','back');await updateLead(env,p,'late',{status:'Квалифицирован',version:2},'synthetic','again');
  await updateLead(env,p,'late',{status:'Продажа',version:3,value:'125.50',currency:'EUR'},'synthetic','sale');db.prepare("UPDATE crm_milestones SET occurred_at='2026-10-21T09:00:00Z' WHERE lead_id='late'").run();
  const before=db.prepare('SELECT * FROM crm_milestones ORDER BY id').all(),queue=db.prepare('SELECT * FROM crm_delivery ORDER BY id').all();
  const old=await result(env,intake),current=await result(env,qualified);
  assert.equal(old.qualified,1);assert.equal(old.sales,0);assert.deepEqual(old.revenue,[]);assert.equal(old.byAd[0].qualified,1);
  assert.equal(current.qualified,0);assert.equal(current.sales,1);assert.deepEqual(current.revenue,[{currency:'EUR',value:125.5}]);assert.equal(current.byAd[0].qualified,0);
  assert.deepEqual(old.dateBasisByMetric,{qualified:'lead_received_at',sales:'first_sale_at',revenue:'first_sale_at'});
  const milestone=before.find(m=>m.kind==='qualified');const payload=await capiPayload(env,db.prepare("SELECT * FROM leads WHERE id='late'").get(),milestone,{qualified_event:'QualifiedLead'});
  assert.equal(payload.event_time,Date.parse('2026-10-21T09:00:00Z')/1000);assert.equal(payload.event_id,milestone.id);
  assert.deepEqual(db.prepare('SELECT * FROM crm_milestones ORDER BY id').all(),before);assert.deepEqual(db.prepare('SELECT * FROM crm_delivery ORDER BY id').all(),queue);
 }finally{db.close();}
});
test('cohort boundaries use the configured timezone, with offset timestamps, provider separation and deletion',async()=>{
 const {env,db}=fixture();try{
  await enable(env,p);const times=['2026-10-09T19:59:59Z','2026-10-09T20:00:00Z','2026-10-10T19:59:59Z','2026-10-10T20:00:00Z','2026-10-10T22:59:59+03:00'];
  for(let i=0;i<times.length;i++){insert(db,'boundary'+i,times[i]);await qualify(env,db,'boundary'+i);}
  insert(db,'google','2026-10-10T12:00:00Z','google_ads','456');await qualify(env,db,'google');
  insert(db,'deleted','2026-10-10T12:00:00Z');await qualify(env,db,'deleted');db.prepare("UPDATE leads SET deleted_at='2026-10-21T10:00:00Z' WHERE id='deleted'").run();
  assert.equal((await result(env,intake)).qualified,4);assert.equal((await result(env,intake,'meta_ads')).qualified,3);assert.equal((await result(env,intake,'google_ads')).qualified,1);assert.equal((await result(env,qualified)).qualified,0);
  db.prepare("UPDATE crm_projects SET timezone='Europe/Prague' WHERE project_id=?").run(p.id);insert(db,'prague','2026-10-10T22:30:00Z');await qualify(env,db,'prague');
  const eleven=await result(env,{from:'2026-10-11',to:'2026-10-11'});assert.equal(eleven.qualified,1);
 }finally{db.close();}
});
test('native and configured legacy attribution use the same intake cohort without exposing lead records',async()=>{
 const {env,db}=fixture();try{
  await enable(env,p);insert(db,'private-id','2026-10-10T09:00:00Z');await qualify(env,db,'private-id');
  const body=()=>({providers:[{provider:'meta_ads',hierarchy:{providerId:'123',children:[{children:[{children:[{providerId:'111'}]}]}]}}]});
  const ad=r=>r.providers[0].hierarchy.children[0].children[0].children[0];
  for(const legacy of [false,true]){
   env.CRM_ATTRIBUTION_CONFIG=legacy?JSON.stringify({[p.slug]:{qualifiedStatuses:['Квалифицирован'],timeZone:'Asia/Tbilisi',completeFrom:'2026-01-01',throughDate:'2026-12-31'}}):'{}';
   const old=await attachCRMQualification(body(),env,p,intake),current=await attachCRMQualification(body(),env,p,qualified);
   assert.equal(ad(old).crmQualifiedLeads.value,'1');assert.equal(ad(current).crmQualifiedLeads.value,'0');assert.equal(old.crmAttribution.dateBasis,'lead_received_at');assert.ok(!JSON.stringify(old).includes('private-id'));
  }
  const config={qualifiedStatuses:['qualified'],timeZone:'Asia/Tbilisi',completeFrom:'2026-01-01',throughDate:'2026-12-31'};
  assert.equal(aggregateQualifiedLeads([{leadId:'missing-date',status:'qualified',changedAt:'2026-10-10T09:00:00Z'}],config,intake).status,'unavailable');
 }finally{db.close();}
});
test('project and master summary endpoints expose identical cohort counts across periods',async()=>{
 const {env,db}=fixture(),worker=await testWorker();try{
  env.MVP_EDITOR_PROJECTS+=',__master';env.MVP_VIEW_PROJECTS=env.MVP_EDITOR_PROJECTS;
  await enable(env,p);insert(db,'api-lead','2026-10-10T09:00:00Z');await qualify(env,db,'api-lead');
  for(const [range,expected]of [[intake,1],[qualified,0]]){
   const q=new URLSearchParams(range),crm=await(await worker.fetch(request('/api/v2/projects/'+p.slug+'/crm/summary?'+q),env)).json(),master=await(await worker.fetch(request('/api/v2/master/projects/'+p.slug+'/summary?'+q),env)).json();
   assert.equal(crm.qualified,expected);assert.equal(master.crm.qualified,expected);assert.equal(crm.dateBasisByMetric.qualified,'lead_received_at');
  }
 }finally{db.close();}
});
