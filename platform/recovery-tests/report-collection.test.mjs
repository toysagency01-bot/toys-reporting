import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
const worker=await testWorker(),base='/api/v2/projects/housevip-cxp7';
const payload=(channel,summary)=>({periodStart:'2026-10-01',periodEnd:'2026-10-15',channel,summary});
test('reports have independent revisions, channels, comments and deletion; creation retries cannot revive deleted reports',async()=>{
 const {db,env}=fixture();env.MVP_EDITOR_PROJECTS+=',__master';
 const keys=['meta','google','smm'].map(()=>`weekly-${crypto.randomUUID()}`);
 const call=(path,body)=>{const r=request(base+path,{method:'POST',body,key:crypto.randomUUID()});r.headers.set('origin','https://test.local');return worker.fetch(r,env);};
 const get=async(path,role='editor')=>(await(await worker.fetch(request(base+path,{role}),env)).json());
 for(const [i,key] of keys.entries()){
  const initialized=await(await call(`/content/${key}/initialize`,{})).json();assert.equal(initialized.ok,true);
  const again=await(await call(`/content/${key}/initialize`,{})).json();assert.equal(again.item.id,initialized.item.id);
  const save=await call(`/content/${key}/save-and-publish`,{expectedRevision:0,expectedPublishedRevisionId:null,blocks:[{type:'period_summary',blockKey:'summary',payload:payload(['meta','google','smm'][i],'Independent report '+i)}]});assert.equal(save.status,201);
 }
 const list=await get('/content/reports','viewer');assert.equal(keys.every(k=>list.reports.some(r=>r.logicalKey===k)),true);
 assert.equal(list.reports.some(r=>'latestRevision' in r||'item' in r),false);
 const metaBefore=await get(`/content/${keys[0]}/revisions`),googleBefore=await get(`/content/${keys[1]}/revisions`);
 const smm=await get(`/content/${keys[2]}/revisions`);
 const draft=await call(`/content/${keys[2]}/revisions`,{expectedRevision:1,blocks:[{type:'period_summary',blockKey:'summary',payload:payload('smm','SMM draft secret')}]});assert.equal(draft.status,201);
 assert.equal(JSON.stringify(await get('/content/reports','viewer')).includes('SMM draft secret'),false);
 assert.equal(JSON.stringify(await get('/content/reports')).includes('SMM draft secret'),true);
 await call(`/content/${keys[2]}/comments`,{body:'Only SMM comment'});
 assert.equal((await get(`/content/${keys[0]}/comments`)).comments.length,0);
 assert.equal((await get(`/content/${keys[2]}/comments`)).comments.length,1);
 const wrong=await call(`/content/${keys[0]}/delete`,{id:smm.item.id,expectedRevision:2,expectedPublishedRevisionId:smm.item.publishedRevisionId});assert.equal(wrong.status,409);
 const deleted=await call(`/content/${keys[2]}/delete`,{id:smm.item.id,expectedRevision:2,expectedPublishedRevisionId:smm.item.publishedRevisionId});assert.equal(deleted.status,200);
 assert.equal((await get('/content/reports')).reports.some(r=>r.logicalKey===keys[2]),false);
 assert.deepEqual(await get(`/content/${keys[0]}/revisions`),metaBefore);assert.deepEqual(await get(`/content/${keys[1]}/revisions`),googleBefore);
 assert.equal((await call(`/content/${keys[2]}/initialize`,{})).status,409);
 assert.equal((await worker.fetch(request(base+`/content/${keys[0]}/initialize`,{role:'viewer',method:'POST',body:{}}),env)).status,403);
 db.close();
});
