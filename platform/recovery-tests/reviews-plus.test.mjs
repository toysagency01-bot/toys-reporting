import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
import {seedReviewsPlus} from './reviews-plus-fixture.mjs';
const worker=await testWorker();
test('Reviews Plus uses the normal private dashboard and project materials without fabricated ad facts',async()=>{
 const {env,db}=fixture();try{
 seedReviewsPlus(env,db);env.MVP_EDITOR_PROJECTS+=',__master';
 const base='/api/v2/projects/reviews-plus';
 const board=await worker.fetch(request('/reviews-plus/'),env);assert.equal(board.status,200);assert.match(await board.text(),/TOYS_UNIFIED_PROJECT="reviews-plus"/);
 const r=await worker.fetch(request(base+'/dashboard'),env);assert.equal(r.status,200);const d=(await r.json()).dashboard;
 assert.equal(d.project.name,'Reviews Plus');assert.equal(d.project.preset,'leadgen');assert.equal(d.coverage.availability,'not_configured');assert.deepEqual(d.facts.rows,[]);assert.ok(d.panels.every(p=>p.value===null));
 const tabs=(await(await worker.fetch(request(base+'/content/tabs'),env)).json()).tabs;assert.equal(tabs.length,7);assert.ok(tabs.some(t=>t.sourceTitle==='План работы (Meta)'));
 const plan=await worker.fetch(request(base+'/content/tabs?tab='+encodeURIComponent('План работы (Meta)')),env);assert.equal(plan.status,200);assert.match(await plan.text(),/02.11.2026/);
 const chooser=await(await worker.fetch(request('/api/v2/portal/session?choose=1'),env)).text();assert.match(chooser,/href="\/reviews-plus\/"/);assert.doesNotMatch(chooser,/master\/#home\?project=reviews-plus/);
 assert.equal((await worker.fetch(request(base+'/dashboard',{role:null}),env)).status,401);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM integrations WHERE project_id='prj_reviews_plus'").get().n,0);
 }finally{db.close();}
});
