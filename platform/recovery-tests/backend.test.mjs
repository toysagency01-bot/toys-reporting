import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
const worker=await testWorker();const base='/api/v2/projects/housevip-cxp7';
test('single shell preserves authentication and rejects other project scopes',async()=>{const {env,db}=fixture();try{
  assert.equal((await worker.fetch(request(base+'/content-project',{role:null}),env)).status,401);
  assert.equal((await worker.fetch(request('/api/v2/projects/profkit-instashop-r4vk/content-project'),env)).status,403);
  const r=await worker.fetch(request(base+'/content-project'),env);assert.equal(r.status,200);const html=await r.text();assert.equal((html.match(/id="dateFrom"/g)||[]).length,1);assert.doesNotMatch(html,/project-workspace\.js|private-tools\.js/);
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
