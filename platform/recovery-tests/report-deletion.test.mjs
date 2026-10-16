import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
const worker=await testWorker(),base='/api/v2/projects/housevip-cxp7';
function post(path,body,role='editor',origin='https://test.local'){const r=request(base+path,{method:'POST',body,role});if(origin)r.headers.set('origin',origin);return r;}
async function history(env){return (await worker.fetch(request(base+'/content/weekly-main/revisions'),env)).json();}
test('only master admins can delete reports; archive removes publication and permits a fresh report',async()=>{
 const {db,env}=fixture();const initial=await history(env);assert.equal(initial.canDelete,false);
 const body={id:initial.item.id,expectedRevision:initial.item.latestRevision,expectedPublishedRevisionId:initial.item.publishedRevisionId};
 const path='/content/weekly-main/delete';
 assert.equal((await worker.fetch(post(path,body),env)).status,403);
 env.MVP_EDITOR_PROJECTS+=',__master';env.MVP_VIEW_PROJECTS+=',__master';assert.equal((await history(env)).canDelete,true);
 assert.equal((await worker.fetch(post(path,body,'viewer'),env)).status,403);assert.equal((await worker.fetch(post(path,body,null),env)).status,401);
 assert.equal((await worker.fetch(post(path,body,'editor','https://evil.example'),env)).status,403);
 assert.equal((await worker.fetch(post(path,body,'editor',''),env)).status,403);
 assert.equal((await worker.fetch(post(path,{...body,expectedRevision:0}),env)).status,409);
 assert.equal((await worker.fetch(post(path,{...body,id:'another-project-item'}),env)).status,409);
 const revisions=db.prepare('SELECT COUNT(*) AS n FROM content_revisions').get().n;
 assert.equal((await worker.fetch(post(path,body),env)).status,200);
 assert.equal(db.prepare('SELECT lifecycle FROM content_items WHERE id=?').get(body.id).lifecycle,'archived');
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM content_revisions').get().n,revisions);
 assert.equal(db.prepare('SELECT actor_ref FROM report_deletions').get().actor_ref,'local-editor');
 assert.equal((await worker.fetch(request(base+'/content?logicalKey=weekly-main',{role:'viewer'}),env)).status,404);
 assert.throws(()=>db.prepare('UPDATE content_items SET latest_revision_number=latest_revision_number+1 WHERE id=?').run(body.id),/report_archived/);
 const fresh=await(await worker.fetch(post('/content/weekly-main/initialize',{}),env)).json();assert.notEqual(fresh.item.id,body.id);assert.equal(fresh.item.latestRevision,0);
 // A retry of the old delete cannot remove the new report.
 assert.equal((await worker.fetch(post(path,body),env)).status,200);assert.equal((await history(env)).item.id,fresh.item.id);
 const save=await worker.fetch(post('/content/weekly-main/save-and-publish',{expectedRevision:0,expectedPublishedRevisionId:null,blocks:[{type:'period_summary',blockKey:'summary',payload:{periodStart:'2026-10-10',periodEnd:'2026-10-16',summary:'Replacement report'}}]}),env);assert.equal(save.status,201);
 assert.equal((await worker.fetch(post('/content/weekly-main/revisions/'+initial.revisions[0].id+'/rollback',{expectedRevision:1,expectedPublishedRevisionId:null}),env)).status,404);
 db.close();
});
test('imported report deletion is scoped, conflict checked and stays hidden after import upsert',async()=>{
 const {db,env}=fixture();env.MVP_EDITOR_PROJECTS+=',__master';
 db.prepare("INSERT INTO weekly_reports(id,project_id,period_start,period_end,summary) VALUES('old-report','prj_housevip_cxp7','2026-10-01','2026-10-07','Older report')").run();
 const read=async()=>(await(await worker.fetch(request(base+'/weekly-reports'),env)).json());
 const before=await read(),row=before.reports.find(r=>r.id==='old-report');assert.equal(before.canDelete,true);
 const body={id:row.id,expectedUpdatedAt:row.updatedAt};
 assert.equal((await worker.fetch(post('/weekly-reports/delete',{...body,expectedUpdatedAt:'stale'}),env)).status,409);
 assert.equal((await worker.fetch(post('/weekly-reports/delete',body),env)).status,200);assert.equal((await read()).reports.some(r=>r.id==='old-report'),false);
 db.prepare("UPDATE weekly_reports SET summary='Imported again',status='published' WHERE id='old-report'").run();assert.equal((await read()).reports.some(r=>r.id==='old-report'),false);
 assert.equal(db.prepare("SELECT summary FROM weekly_reports WHERE id='old-report'").get().summary,'Imported again');
 const publicRead=await(await worker.fetch(request(base+'/weekly-reports',{role:null}),{...env,ENVIRONMENT:'staging'})).json();assert.equal(publicRead.canDelete,false);assert.equal(publicRead.reports.some(r=>r.id==='old-report'),false);db.close();
});
