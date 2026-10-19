import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
import {createBoard,getBoard,listBoards,validatePipeline} from '../crm/boards.js';
import {enable,ingest,updateLead,listLeads,summary} from '../crm/service.js';
const p={id:'prj_housevip_cxp7',slug:'housevip-cxp7',timezone:'Asia/Tbilisi'};
const stages=[{label:'Входящие',kind:null},{label:'Обсуждаем',kind:'qualified'},{label:'Не подходит',kind:null},{label:'Оплачено',kind:'sale',countsAsQualified:true}];
const view=(env,id='default',extra='')=>listLeads(env,p,new URL('https://test/?view=board&board='+id+extra));

test('boards isolate leads, pagination and metrics, preserving import identity and qualification on transfer',async()=>{
 const {env,db}=fixture();try{
  await enable(env,p);db.prepare("UPDATE crm_projects SET capi_kinds='qualified'").run();
  const old=await ingest(env,p,{name:'Old lead',phone:'+995555010001'},'meta_lead_ads','123456');
  const b=await createBoard(env,p,{name:'Отдел B2B',stages},'owner','board1');
  assert.deepEqual(await createBoard(env,p,{name:'Отдел B2B',stages},'owner','board1'),b);
  await assert.rejects(createBoard(env,p,{name:'Changed',stages},'owner','board1'),{code:'idempotency_conflict'});
  await assert.rejects(createBoard(env,p,{name:'Отдел B2B',stages},'owner','board2'),{code:'board_name_exists'});
  assert.equal((await listBoards(env,p)).length,2);assert.equal((await view(env)).total,1);assert.equal((await view(env,b.id)).total,0);
  const fresh=await ingest(env,p,{name:'B2B lead',phone:'+995555010002',boardId:b.id},'manual','b2blead');assert.equal(fresh.status,'Входящие');
  await updateLead(env,p,fresh.id,{status:'Обсуждаем',version:1},'owner','qualify');assert.equal((await view(env,b.id)).summary.qualified,1);assert.equal((await view(env)).summary.qualified,0);
  await updateLead(env,p,fresh.id,{boardId:'default',status:'Квалифицирован',version:2},'owner','transfer');
  assert.equal((await view(env,b.id)).total,0);assert.equal((await view(env)).summary.qualified,1);
  assert.equal(db.prepare("SELECT count(*) n FROM crm_delivery WHERE kind='capi'").get().n,1);
  await updateLead(env,p,fresh.id,{boardId:b.id,status:'Не подходит',version:3},'owner','reject');assert.equal((await view(env,b.id)).summary.qualified,0);
  await updateLead(env,p,fresh.id,{status:'Оплачено',value:'250',currency:'EUR',version:4},'owner','sold');
  assert.equal((await view(env,b.id)).summary.qualified,1);assert.equal((await view(env,b.id)).summary.sales,1);assert.equal((await view(env)).summary.sales,0);
  assert.equal(db.prepare("SELECT count(*) n FROM crm_delivery WHERE kind='capi'").get().n,1);
  assert.equal((await summary(env,p,'2026-01-01','2099-01-01')).qualified,1);
  await updateLead(env,p,old.id,{boardId:b.id,status:'Входящие',version:1},'owner','move-import');
  await ingest(env,p,{phone:'+995555010001'},'meta_lead_ads','123456');assert.equal((await view(env)).total,0,'provider retries do not move transferred leads back');
  const incoming=await ingest(env,p,{phone:'+995555010003',boardId:b.id},'meta_lead_ads','123457');assert.equal(incoming.status,'Новый','provider input cannot reroute automatic intake');assert.equal((await view(env)).total,1);
  for(let i=0;i<27;i++)await ingest(env,p,{name:'Paged '+i,phone:'+995555010004',boardId:b.id},'manual','paged'+i);
  const column=(await view(env,b.id)).columns[0];assert.equal(column.total,28);assert.equal(column.leads.length,25);assert.equal(column.hasMore,true);
  const more=await listLeads(env,p,new URL('https://test/?board='+b.id+'&status='+encodeURIComponent('Входящие')+'&offset=25'));assert.equal(more.leads.length,3);assert.ok(more.leads.every(l=>l.boardId===b.id));
  assert.equal((await view(env,'default','&q=B2B')).total,0);assert.equal((await view(env,b.id,'&q=B2B')).total,1);
  const history=JSON.parse(db.prepare("SELECT note FROM lead_status_events WHERE lead_id=? AND to_status='Не подходит'").get(fresh.id).note);assert.equal(history.boardMove.name,'Отдел B2B');
 }finally{db.close();}
});

test('foreign boards and invalid stages fail without changing the lead or sending CAPI',async()=>{
 const {env,db}=fixture();try{
  db.prepare("INSERT INTO projects(id,organization_id,slug,name) VALUES('other','org_toys_agency','other','Other')").run();
  const foreign=await createBoard(env,{id:'other'},{name:'Foreign',stages},'owner','other');await enable(env,p);
  const lead=await ingest(env,p,{phone:'+995555010000'},'manual','lead');
  await assert.rejects(getBoard(env,p,foreign.id),{code:'board_not_found'});
  await assert.rejects(updateLead(env,p,lead.id,{boardId:foreign.id,status:'Обсуждаем',version:1},'owner','cross'),{code:'board_not_found'});
  await assert.rejects(ingest(env,p,{phone:'+995555010000',boardId:foreign.id},'manual','cross-new'),{code:'board_not_found'});
  assert.equal((await view(env)).total,1);assert.equal(db.prepare('SELECT count(*) n FROM crm_milestones').get().n,0);
  assert.throws(()=>validatePipeline([{label:'New',kind:'qualified'},...stages]),{code:'invalid_board_stages'});
  assert.throws(()=>validatePipeline([{label:' X ',kind:null},{label:'x',kind:'sale'}]),{code:'invalid_board_stages'});
  assert.throws(()=>validatePipeline([{label:'New'},{label:'Working'}]),{code:'board_sale_stage_required'});
  assert.throws(()=>validatePipeline([...stages,{label:'Another sale',kind:'sale'}]),{code:'board_sale_stage_required'});
  assert.throws(()=>validatePipeline([{label:'New',kind:'invented'},...stages]),{code:'invalid_board_stages'});
 }finally{db.close();}
});

test('board creation requires assigned admin/team access and respects admin-only CRM and CSRF',async()=>{
 const worker=await testWorker(),{env,db}=fixture();try{
  const path='/api/v2/projects/housevip-cxp7/crm/boards',body={name:'Sales',stages};
  const call=role=>worker.fetch(request(path,{method:'POST',body,role,key:'create-'+role}),env);
  assert.equal((await call(null)).status,401);assert.equal((await call('viewer')).status,403);
  assert.equal((await call('editor')).status,201);assert.equal((await worker.fetch(request(path,{role:'viewer'}),env)).status,200);
  assert.equal((await worker.fetch(request(path.replace('housevip-cxp7','other'),{method:'POST',body,role:'editor'}),env)).status,403);
  const csrf=request(path,{method:'POST',body,role:'editor'});csrf.headers.set('origin','https://evil.example');assert.equal((await worker.fetch(csrf,env)).status,403);
  await enable(env,p);db.prepare("UPDATE crm_projects SET access_mode='admin'").run();assert.equal((await call('editor')).status,403);
  env.MVP_EDITOR_PROJECTS+=',__master';assert.equal((await worker.fetch(request(path,{method:'POST',body:{name:'Admin',stages},key:'admin'}),env)).status,201);
 }finally{db.close();}
});
