import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
import {getBoard,updateBoard,createBoard,boardDetails} from '../crm/boards.js';
import {ingest,listLeads,updateLead} from '../crm/service.js';
import {runLeadBatch} from '../master/crm-bulk.js';
const p={id:'prj_housevip_cxp7',slug:'housevip-cxp7'};
const stages=b=>b.pipeline.stages.map(s=>({...s,origin:s.label}));
const view=env=>listLeads(env,p,new URL('http://test/?view=board'));
test('rename and reorder primary stages preserve every lead, versions, qualifications and conversion history',async()=>{
 const {env,db}=fixture();try{
  const a=await ingest(env,p,{phone:'+111',name:'A'},'manual','a');await updateLead(env,p,a.id,{status:'Квалифицирован',version:1},'admin','qualify');
  const old=await getBoard(env,p),next=stages(old);next[0].label='Входящие';next[2].label='Квал проверен';[next[1],next[2]]=[next[2],next[1]];
  const result=await updateBoard(env,p,'default',{name:'Отдел продаж',version:0,stages:next},'admin','edit');
  assert.equal(result.board.version,1);assert.deepEqual(await updateBoard(env,p,'default',{name:'Отдел продаж',version:0,stages:next},'admin','edit'),result);
  const data=await view(env);assert.equal(data.total,1);assert.equal(data.summary.qualified,1);assert.equal(data.columns[1].leads[0].id,a.id);assert.equal(data.columns[1].leads[0].version,3);
  assert.equal(db.prepare('SELECT count(*) n FROM crm_milestones').get().n,1);assert.equal(db.prepare('SELECT count(*) n FROM crm_delivery').get().n,1);
  assert.equal(db.prepare("SELECT count(*) n FROM audit_log WHERE action='crm.board.updated'").get().n,1);
  const fresh=await ingest(env,p,{phone:'+222'},'meta_lead_ads','fb-new');assert.equal(fresh.status,'Входящие');
  await assert.rejects(updateLead(env,p,a.id,{status:'В работе',version:2},'admin','stale'),{code:'version_conflict'});
  await assert.rejects(updateBoard(env,p,'default',{name:'Stale',version:0,stages:next},'admin','stale-board'),{code:'board_version_conflict'});
 }finally{db.close();}
});
test('occupied stages cannot disappear; after explicit transfer deletion succeeds and CAPI deduplicates',async()=>{
 const {env,db}=fixture();try{
  const a=await ingest(env,p,{phone:'+111'},'manual','a'),old=await getBoard(env,p),next=stages(old).filter(s=>s.label!=='Новый');
  await assert.rejects(updateBoard(env,p,'default',{name:'Primary',version:0,stages:next},'admin','remove'),{code:'board_changed_or_not_empty'});
  assert.equal((await view(env)).total,1);assert.equal((await getBoard(env,p)).version,0);
  await updateLead(env,p,a.id,{status:'Квалифицирован',version:1},'admin','transfer');
  // The new first stage remains ordinary, even when qualification was later.
  await updateBoard(env,p,'default',{name:'Primary',version:0,stages:next},'admin','remove');
  assert.equal((await view(env)).total,1);assert.equal((await view(env)).summary.qualified,1);assert.equal(db.prepare('SELECT count(*) n FROM crm_delivery').get().n,1);
 }finally{db.close();}
});
test('populated ordinary stages cannot become sales without explicit deal values; custom boards remain isolated',async()=>{
 const {env,db}=fixture();try{
  await ingest(env,p,{phone:'+111'},'manual','a');const old=await getBoard(env,p),next=stages(old);next[3].kind=null;next[1].kind='sale';
  const a=await ingest(env,p,{phone:'+222'},'manual','b');await updateLead(env,p,a.id,{status:'В работе',version:1},'admin','work');
  await assert.rejects(updateBoard(env,p,'default',{name:'Primary',version:0,stages:next},'admin','sale'),{code:'board_sale_requires_transfer'});
  const b=await createBoard(env,p,{name:'Other',stages:old.pipeline.stages},'admin','other');const n=stages(b);n[0].label='Other incoming';await updateBoard(env,p,b.id,{name:'Other renamed',version:0,stages:n},'admin','other-edit');
  assert.equal((await getBoard(env,p)).pipeline.stages[0].label,'Новый');assert.equal((await getBoard(env,p,b.id)).name,'Other renamed');assert.equal((await boardDetails(env,p,b.id)).counts.length,0);
 }finally{db.close();}
});
test('board endpoints enforce project scope and staff role',async()=>{
 const worker=await testWorker(),{env,db}=fixture();try{
  const path='/api/v2/projects/housevip-cxp7/crm/boards/default';
  assert.equal((await worker.fetch(request(path,{role:null}),env)).status,401);
  assert.equal((await worker.fetch(request(path,{role:'viewer'}),env)).status,403);
  assert.equal((await worker.fetch(request(path),env)).status,200);
  assert.equal((await worker.fetch(request(path.replace('housevip-cxp7','foreign')),env)).status,403);
 }finally{db.close();}
});
test('batch results preserve partial successes, report exact progress and stop on access loss',async()=>{
 const progress=[];const results=await runLeadBatch([{id:'a'},{id:'b'},{id:'c'}],async x=>{if(x.id==='b')throw Object.assign(new Error('conflict'),{status:409});},(n,total)=>progress.push([n,total]));
 assert.deepEqual(results.map(r=>[r.id,r.ok]),[['a',true],['b',false],['c',true]]);assert.deepEqual(progress,[[1,3],[2,3],[3,3]]);
 let calls=0;await runLeadBatch([{id:'a'},{id:'b'}],async()=>{calls++;throw Object.assign(new Error('forbidden'),{status:403});});assert.equal(calls,1);
});
test('an in-flight intake or cross-board move cannot enter a stale stage after board editing',async()=>{
 const {env,db}=fixture();try{
  const old=await getBoard(env,p),target=await createBoard(env,p,{name:'Target',stages:old.pipeline.stages},'admin','target');
  const lead=await ingest(env,p,{phone:'+111'},'manual','a');
  const batch=env.TOYS_DB.batch.bind(env.TOYS_DB);let inject=true;
  env.TOYS_DB.batch=async statements=>{if(inject){inject=false;const next=stages(target);next[1].label='Contact renamed';await updateBoard(env,p,target.id,{name:target.name,version:0,stages:next},'admin','rename-target');}return batch(statements);};
  await assert.rejects(updateLead(env,p,lead.id,{boardId:target.id,status:'В работе',version:1},'admin','stale-transfer'),{code:'version_conflict'});
  assert.equal((await view(env)).total,1);assert.equal(db.prepare('SELECT count(*) n FROM lead_status_events').get().n,0);
  inject=true;env.TOYS_DB.batch=async statements=>{if(inject){inject=false;const next=stages(old);next[0].label='Fresh intake';await updateBoard(env,p,'default',{name:old.name,version:0,stages:next},'admin','rename-intake');}return batch(statements);};
  await assert.rejects(ingest(env,p,{phone:'+222'},'manual','late-intake','admin'),{code:'board_version_conflict'});
  assert.equal(db.prepare("SELECT count(*) n FROM leads WHERE external_lead_id='late-intake'").get().n,0);
  assert.equal(db.prepare("SELECT count(*) n FROM audit_log WHERE action='crm.lead.created' AND request_id='late-intake'").get().n,0);
  assert.equal((await ingest(env,p,{phone:'+222'},'manual','late-intake','admin')).status,'Fresh intake');
 }finally{db.close();}
});
