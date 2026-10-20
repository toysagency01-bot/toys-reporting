import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,testWorker,request} from './fixture.mjs';
import {summary} from '../crm/service.js';
import {reviewProjectIncluded} from '../master/review-scope.js';
const worker=await testWorker(),api='/api/v2/projects/nova-sales-demo';
test('synthetic showroom reconciles dashboard, CRM, channels and published reports without delivery jobs',async()=>{
 const {db,env}=fixture();
 try{
  const before=db.prepare("SELECT * FROM projects WHERE slug='housevip-cxp7'").get();
  const sql=readFileSync('dist/sales-demo/import.sql','utf8');db.exec(sql);db.exec(sql);
  env.MVP_EDITOR_PROJECTS+=',nova-sales-demo,__master';env.MVP_VIEW_PROJECTS=env.MVP_EDITOR_PROJECTS;
  const get=async path=>{const res=await worker.fetch(request(api+path),env);assert.equal(res.status,200,await res.clone().text());return res.json();};
  const dashboard=(await get('/dashboard?from=2026-08-01&toExclusive=2026-10-20')).dashboard;
  const rows=Object.values(dashboard.advertising.channels).flatMap(d=>d.rows);
  assert.equal(rows.length,400);
  const sum=code=>rows.reduce((s,r)=>s+Number(r.metrics.find(m=>m.metricCode===code).value),0);
  assert.equal(Math.round(sum('ads.spend')*100),2410000);assert.equal(sum('ads.reported_conversions'),1416);
  const range='?from=2026-08-01&to=2026-10-19';
  const crm=await get('/crm/summary'+range);assert.equal(crm.qualified,822);assert.equal(crm.sales,203);assert.deepEqual(crm.revenue,[{currency:'EUR',value:313930}]);
  const p={id:'prj_nova_sales_demo'},meta=await summary(env,p,'2026-08-01','2026-10-19','meta_ads'),google=await summary(env,p,'2026-08-01','2026-10-19','google_ads');
  assert.equal(meta.qualified+google.qualified,822);assert.equal(meta.sales+google.sales,203);
  const board=await get('/crm?view=board');assert.equal(board.total,1416);assert.equal(board.summary.qualified,822);assert.equal(board.summary.sales,203);assert.equal(board.summary.revenue[0].value,313930);
  const reports=await get('/content/reports');assert.equal(reports.reports.length,6);assert.ok(reports.reports.every(r=>r.publishedRevision));
  const tabs=await get('/content/tabs');assert.equal(tabs.tabs.length,9);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM crm_delivery').get().n,0);
  assert.equal(reviewProjectIncluded({slug:'nova-sales-demo'}),false);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM integrations WHERE project_id='prj_nova_sales_demo'").get().n,0);
  assert.deepEqual(db.prepare("SELECT * FROM projects WHERE slug='housevip-cxp7'").get(),before);
 }finally{db.close();}
});
