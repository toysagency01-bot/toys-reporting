import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
const worker=await testWorker();const base='/api/v2/projects/housevip-cxp7';
test('single shell preserves authentication and rejects other project scopes',async()=>{const {env,db}=fixture();try{
  assert.equal((await worker.fetch(request(base+'/content-project',{role:null}),env)).status,401);
  assert.equal((await worker.fetch(request('/api/v2/projects/profkit-instashop-r4vk/content-project'),env)).status,403);
  const r=await worker.fetch(request(base+'/content-project'),env);assert.equal(r.status,200);const html=await r.text();assert.match(html,/TOYS_PLATFORM/);assert.doesNotMatch(html,/project-workspace\.js|private-tools\.js/);
}finally{db.close();}});
test('draft, durable readback, publish, comments and rollback use the real recovered API',async()=>{const{env,db}=fixture();try{
  const call=async(path,options)=>{const response=await worker.fetch(request(base+path,options),env);const data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data;};
  const history=await call('/content/weekly-main/revisions');
  const blocks=[{type:'period_summary',blockKey:'summary',payload:{summary:'Результат недели',nextSteps:'Запустить новый тест',periodStart:'2026-10-01',periodEnd:'2026-10-07'}}];
  const draft=await call('/content/weekly-main/revisions',{method:'POST',key:'draft-synthetic-1',body:{expectedRevision:history.item.latestRevision,blocks}});
  const detail=await call('/content/weekly-main/revisions/'+draft.revision.id);assert.equal(detail.revision.blocks[0].payload.summary,'Результат недели');
  const publicBefore=await call('/content?logicalKey=weekly-main',{role:'viewer'});assert.notEqual(publicBefore.publishedRevision?.id,draft.revision.id);
  const published=await call('/content/weekly-main/revisions/'+draft.revision.id+'/publish',{method:'POST',key:'publish-synthetic-1',body:{expectedPublishedRevisionId:history.item.publishedRevisionId}});
  const publicAfter=await call('/content?logicalKey=weekly-main',{role:'viewer'});assert.equal(publicAfter.publishedRevision.id,draft.revision.id);
  const comment=await call('/content/weekly-main/comments',{method:'POST',key:'comment-synthetic-1',body:{body:'План согласован'}});
  assert.equal((await call('/content/weekly-main/comments')).comments[0].body,'План согласован');
  const current=await call('/content/weekly-main/revisions');
  const rollback=await call('/content/weekly-main/revisions/'+history.item.publishedRevisionId+'/rollback',{method:'POST',key:'rollback-synthetic-1',body:{expectedRevision:current.item.latestRevision,expectedPublishedRevisionId:current.item.publishedRevisionId}});
  assert.equal((await call('/content?logicalKey=weekly-main')).publishedRevision.id,rollback.revision.id);
  const before=db.prepare('SELECT count(*) n FROM content_revisions').get().n;
  const conflict=await worker.fetch(request(base+'/content/weekly-main/revisions',{method:'POST',key:'conflict-synthetic',body:{expectedRevision:0,blocks}}),env);assert.equal(conflict.status,409);assert.equal(db.prepare('SELECT count(*) n FROM content_revisions').get().n,before);
  assert.equal((await worker.fetch(request(base+'/content/weekly-main/comments',{role:null}),env)).status,401);
}finally{db.close();}});
test('project materials are gviz documents, and creative availability reflects missing storage',async()=>{const{env,db}=fixture();try{
  const table=await (await worker.fetch(request(base+'/content/tabs?tab='+encodeURIComponent('План работ (Meta)')),env)).json();assert.equal(table.status,'ok');
  const creative=await (await worker.fetch(request(base+'/content-project/creatives'),env)).json();assert.equal(creative.storage.available,false);assert.deepEqual(creative.creatives,[]);
}finally{db.close();}});
test('public short links use the original board with public scope and never expose editor capabilities',async()=>{const{env,db}=fixture();try{
 env.ENVIRONMENT='staging';const r=await worker.fetch(request('/housevip-cxp7/',{role:null}),env);assert.equal(r.status,200);const body=await r.text();assert.match(body,/window.TOYS_MVP_PROJECT_PORTAL=false/);assert.match(body,/window.TOYS_UNIFIED_PROJECT="housevip-cxp7"/);assert.doesNotMatch(body,/Общий результат и кампании/);
 const a=await worker.fetch(request('/housevip-cxp7/?ui=assets%2Ftoys-logo.svg',{role:null}),env);assert.equal(a.status,200);assert.match(a.headers.get('content-type'),/image\/svg/);
 const denied=await worker.fetch(request('/karlovarska-sul-k4rm/',{role:null}),env);assert.equal(denied.status,403);
 const draft=await worker.fetch(request(base+'/content/weekly-main/revisions',{role:null}),env);assert.notEqual(draft.status,200);
}finally{db.close();}});
test('signed-in viewer can review submitted ready creatives but cannot upload or see drafts',async()=>{
 const{env,db}=fixture();try{
  const create=await worker.fetch(request(base+'/content-project/creatives',{method:'POST',body:{fileName:'review.png',mediaType:'image/png',byteSize:64,sha256:'a'.repeat(64)}}),env);assert.equal(create.status,201);const id=(await create.json()).creative.id;
  db.prepare("UPDATE creative_assets SET storage_provider='r2',storage_key='synthetic',upload_state='ready' WHERE id=?").run(id);
  let r=await worker.fetch(request(base+'/content-project/creatives',{role:'viewer'}),env);assert.deepEqual((await r.json()).creatives,[]);
  r=await worker.fetch(request(base+'/content-project/creatives/'+id+'/comments',{role:'viewer'}),env);assert.equal(r.status,404);
  r=await worker.fetch(request(base+'/content-project/creatives/'+id,{method:'PATCH',key:'synthetic-submit',body:{status:'in_review',expectedStatus:'draft',expectedVersion:1}}),env);assert.equal(r.status,200);
  r=await worker.fetch(request(base+'/content-project/creatives',{role:'viewer'}),env);assert.equal((await r.json()).creatives.length,1);
  r=await worker.fetch(request(base+'/content-project/creatives/'+id,{role:'viewer',method:'PATCH',key:'synthetic-forbidden',body:{status:'draft',expectedStatus:'in_review',expectedVersion:2}}),env);assert.equal(r.status,403);
  r=await worker.fetch(request(base+'/content-project/creatives/'+id,{role:'viewer',method:'PATCH',key:'stale-review',body:{status:'approved',expectedStatus:'in_review',expectedVersion:1}}),env);assert.equal(r.status,409);
  r=await worker.fetch(request(base+'/content-project/creatives/'+id,{role:'viewer',method:'PATCH',key:'synthetic-review',body:{status:'rejected',expectedStatus:'in_review',expectedVersion:2,reason:'Заменить заголовок'}}),env);assert.equal(r.status,200);
  r=await worker.fetch(request(base+'/content-project/creatives'),env);assert.equal((await r.json()).creatives[0].reviewReason,'Заменить заголовок');
  r=await worker.fetch(request(base+'/content-project/creatives/'+id+'/upload',{role:'viewer',method:'PUT'}),env);assert.equal(r.status,403);
 }finally{db.close();}
});
