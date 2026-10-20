import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,testWorker,request} from './fixture.mjs';
import {salesDemoAnalytics} from '../native/sales-demo-analytics.js';
const worker=await testWorker(),api='/api/v2/projects/nova-sales-demo',project={id:'prj_nova_sales_demo',slug:'nova-sales-demo'},range={from:'2026-08-01',to:'2026-10-19'};
function setup(){const f=fixture();f.db.exec(readFileSync('dist/sales-demo/import.sql','utf8'));f.env.MVP_EDITOR_PROJECTS+=',nova-sales-demo,__master';return f;}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
test('full funnel and campaign outcomes reconcile; ratios are weighted totals and zero sales remain zero',async()=>{
 const {db,env}=setup();try{
  const all=await salesDemoAnalytics(env,project,range),t=all.totals;
  assert.equal(t.leads,1416);assert.equal(t.qualifiedLeads,822);assert.equal(t.sales,203);assert.equal(t.revenue,313930);assert.equal(t.spend,24100);
  close(t.qualificationRate,822/1416*100);close(t.qualifiedSaleRate,203/822*100);close(t.saleRate,203/1416*100);close(t.cpql,24100/822);close(t.cac,24100/203);
  for(const k of ['leads','qualifiedLeads','sales','revenue','spend'])close(all.campaigns.reduce((n,c)=>n+c[k],0),t[k]);
  assert.equal(all.steps.at(-1).value,203);close(all.steps.at(-1).previousRate,203/822*100);close(all.steps.at(-1).totalRate,203/t.impressions*100);
  const brand=all.campaigns.find(c=>c.campaignId==='demo-google-brand');assert.equal(brand.sales,0);assert.equal(brand.revenue,0);assert.equal(brand.saleRate,0);assert.equal(brand.cac,null);assert.equal(brand.crmRoas,0);
  const meta=await salesDemoAnalytics(env,project,range,'meta_ads'),google=await salesDemoAnalytics(env,project,range,'google_ads');assert.equal(meta.totals.sales+google.totals.sales,203);assert.ok(meta.campaigns.every(c=>c.provider==='meta_ads'));
  const result=await worker.fetch(request(api+'/campaign-browser?'+new URLSearchParams(range)),env);assert.equal(result.status,200);const page=await result.json();assert.equal(page.rows.length,5);assert.ok(page.rows.every(r=>r.salesAnalytics));assert.equal(page.rows.reduce((n,r)=>n+r.metrics.sales,0),203);assert.equal(page.rows.reduce((n,r)=>n+r.metrics.revenue,0),313930);
  const apiResult=await(await worker.fetch(request(api+'/sales-analytics?'+new URLSearchParams(range)),env)).json();assert.equal(apiResult.totals.sales,203);assert.ok(!JSON.stringify(apiResult).includes('example.test'));assert.equal(apiResult.campaigns,undefined);
 }finally{db.close();}
});
test('cohorts follow lead creation in Tbilisi, retain milestones after lost statuses, and exclude deleted contacts',async()=>{
 const {db,env}=setup();try{
  db.exec("UPDATE leads SET current_status='Нет ответа, без номера, мусор' WHERE id='nova_demo_lead_0001'");
  const all=await salesDemoAnalytics(env,project,range);assert.equal(all.totals.sales,203);
  db.exec("UPDATE leads SET created_at='2026-07-31T21:00:00Z' WHERE id='nova_demo_lead_0001'; UPDATE crm_milestones SET occurred_at='2026-09-01T10:00:00Z' WHERE lead_id='nova_demo_lead_0001'");
  const august=await salesDemoAnalytics(env,project,{from:'2026-08-01',to:'2026-08-31'});assert.equal(august.totals.sales,48);
  db.exec("UPDATE leads SET deleted_at='2026-10-20T09:00:00Z' WHERE id='nova_demo_lead_0001'");
  const deleted=await salesDemoAnalytics(env,project,range);assert.equal(deleted.totals.leads,1415);assert.equal(deleted.totals.sales,202);
  const empty=await salesDemoAnalytics(env,project,{from:'2026-12-01',to:'2026-12-31'});assert.equal(empty.hasData,false);assert.equal(empty.totals.saleRate,null);assert.equal(empty.steps.at(-1).previousRate,null);
 }finally{db.close();}
});
