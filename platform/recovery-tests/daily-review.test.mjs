import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,request,testWorker} from './fixture.mjs';
import {analyzeProject,analyzeNode,reviewPeriods,reviewDue} from '../master/review-model.js';
import {generateDailyReviews,runDailyReview,dailyReviewResponse} from '../master/review-service.js';
import {saveAdsSnapshot,dates} from '../imports/ads-store.js';
const now=Date.parse('2026-10-14T05:30:00Z'),reportDate='2026-10-14',periods=reviewPeriods(reportDate,'Europe/Prague');
const observed=value=>({state:'observed',value:String(value)}),range={from:'2026-09-30',to:'2026-10-13'};
const project={id:'prj_housevip_cxp7',organizationId:'org_toys_agency',slug:'housevip-cxp7',name:'Synthetic project',type:'leadgen'};
function source(options={}){
 const dailyMetrics=dates(range.from,range.to).map(date=>({date,metrics:Object.fromEntries(Object.entries({spend:100,impressions:10000,clicks:600,conversions:20,...(date===range.to?options.current:{}),...(options.all||{})}).map(([key,value])=>[key,observed(value)]))}));
 const ad={providerId:'3',level:'ad',name:'Synthetic ad',dailyMetrics,children:[],outcomeDaily:options.outcomes||[]};
 const group={providerId:'2',level:'group',name:'Synthetic group',dailyMetrics,children:[ad]},campaign={providerId:'1',level:'campaign',name:'Synthetic campaign',dailyMetrics,children:[group]};
 return {organizationId:project.organizationId,projectId:project.id,integrationId:'integration-test',accountId:'123',provider:'meta_ads',timezone:'Europe/Prague',currency:'CZK',coveredDates:dates(range.from,range.to),checkedAt:new Date(now).toISOString(),issues:[],hierarchy:{providerId:'123',level:'account',name:'Synthetic account',timezone:'Europe/Prague',currency:'CZK',dailyMetrics,children:[campaign]}};
}
async function setup(options={}){
 const f=fixture();f.db.exec(readFileSync(new URL('../migrations/0017_direct_ads.sql',import.meta.url),'utf8'));
 const s=source(options);
 f.db.prepare('INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES(?,?,?,?,?,?)').run(s.integrationId,project.id,s.provider,'act_123','active',JSON.stringify({accountTimezone:s.timezone,expectedCurrency:s.currency}));
 await saveAdsSnapshot(f.env.TOYS_DB,s,{...s,requestedRange:range,coverage:'complete',fetchedAt:new Date(now).toISOString()});
 return {...f,source:s};
}
test('09:30 Tbilisi schedule and last CLOSED account-local days include LA and date boundaries',()=>{
 assert.equal(reviewDue(now-60000),false);assert.equal(reviewDue(now),true);assert.equal(reviewDue(now+2*60000),false);assert.equal(reviewDue(now+10*60000),true);assert.equal(reviewDue(now+100*60000),false);
 assert.equal(periods.day.to,'2026-10-13');assert.equal(reviewPeriods(reportDate,'America/Los_Angeles').day.to,'2026-10-12');assert.equal(reviewPeriods('2026-01-01','Asia/Tbilisi').day.to,'2025-12-31');
});
test('ratios use same-currency totals, a major CPA change is urgent and duplicate hierarchy warnings collapse to the ad',()=>{
 const report=analyzeProject(project,[source({current:{spend:400}})],{reportDate,generatedAt:new Date(now).toISOString()});
 assert.equal(report.priority,'critical');assert.equal(report.accounts[0].day.spend,400);assert.equal(report.accounts[0].day.conversions,20);
 const cpa=report.findings.filter(f=>f.code==='cpa_up');assert.equal(cpa.length,1);assert.equal(cpa[0].level,'ad');assert.equal(cpa[0].confidence,'medium');assert.equal(cpa[0].path.length,3);assert.equal(cpa[0].evidence.includes('300%'),true);assert.deepEqual(report.automaticChanges,[]);
});
test('low daily sample widens to a week, remains explicit about confidence and cannot claim fatigue/scaling',()=>{
 const s=source({all:{conversions:3,clicks:60}}),node=s.hierarchy;
 const r=analyzeNode({node,source:s,project,periods});
 assert.equal(r.day.conversions,3);assert.equal(r.week.conversions,21);
 // Stable low-volume data never produces a scale instruction.
 const report=analyzeProject(project,[s],{reportDate});assert.equal(report.decision,'keep');assert.equal(report.findings.some(f=>f.decision==='scale'),false);
 const spikes=source({current:{spend:400,conversions:1,clicks:60}}),analysis=analyzeNode({node:spikes.hierarchy,source:spikes,project,periods});
 assert.ok(analysis.findings.every(f=>f.period.from===periods.week.from));
});
test('missing dates never become zero results; source failures cannot produce a healthy or performance verdict',()=>{
 const s=source({current:{spend:1000,conversions:0}});s.coveredDates=s.coveredDates.filter(d=>d!==range.to);s.failed=true;
 const report=analyzeProject(project,[s],{reportDate});assert.equal(report.priority,'critical');assert.equal(report.incomplete,true);assert.equal(report.accounts[0].day,null);assert.deepEqual(report.findings.map(f=>f.code),['data_quality']);
});
test('Google generic conversions/value do not become purchases or ROAS; currencies stay separate',()=>{
 const s=source();s.provider='google_ads';s.currency='EUR';s.hierarchy.currency='EUR';
 const report=analyzeProject({...project,type:'ecommerce'},[s,source()],{reportDate});assert.equal(report.accounts.length,2);assert.deepEqual(report.accounts.map(a=>a.currency),['EUR','CZK']);assert.ok(report.accounts.every(a=>a.day.roas===null));assert.ok(report.limitations.some(s=>s.includes('Google: нет подтверждённой')));
});
test('zero purchase revenue has ROAS zero, with outcome evidence and low confidence at small sample',()=>{
 const s=source({outcomes:dates(range.from,range.to).map(date=>({date,metrics:{purchases:observed(date===range.to?0:2),purchaseValue:observed(date===range.to?0:200)}}))});
 const report=analyzeProject({...project,type:'ecommerce'},[s],{reportDate});assert.equal(report.accounts[0].day.roas,0);assert.ok(report.findings.some(f=>f.code==='roas_down'&&f.severity==='attention'&&f.confidence==='low'));
});
test('inactive historical branches do not hide observed account ROAS; a genuinely missing active purchase outcome still does',()=>{
 const s=source({outcomes:dates(range.from,range.to).map(date=>({date,metrics:{purchases:observed(2),purchaseValue:observed(200)}}))});
 const old=structuredClone(s.hierarchy.children[0]);old.providerId='old';
 function priorOnly(n){n.dailyMetrics=n.dailyMetrics.filter(d=>d.date<range.to);for(const child of n.children)priorOnly(child);}priorOnly(old);s.hierarchy.children.push(old);
 let report=analyzeProject({...project,type:'ecommerce'},[s],{reportDate});assert.equal(report.accounts[0].day.purchaseValue,200);assert.equal(report.accounts[0].day.roas,2);
 s.hierarchy.children[0].children[0].children[0].outcomeDaily=[];
 report=analyzeProject({...project,type:'ecommerce'},[s],{reportDate});assert.equal(report.accounts[0].day.roas,null);
});
test('only active projects, canonical snapshots, timezone/currency overrides, no live API calls or source mutations',async()=>{
 const {env,db}=await setup();try{
  db.exec("INSERT INTO projects(id,organization_id,slug,name,status) VALUES('inactive','org_toys_agency','inactive','Inactive','inactive'),('draft','org_toys_agency','draft','Draft','draft')");
  const reports=await generateDailyReviews(env.TOYS_DB,reportDate,now);assert.equal(reports.length,1);assert.equal(reports[0].accounts[0].day.conversions,20);assert.equal(reports[0].priority,'healthy');assert.equal(reports[0].accounts[0].timeZone,'Europe/Prague');
  const payload=JSON.stringify(reports);for(const forbidden of ['act_123','integration-test','external_account_id','metadata_json','access_token'])assert.equal(payload.includes(forbidden),false);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ads_daily_snapshots').get().n,14);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM agency_daily_reviews').get().n,0);
 }finally{db.close();}
});
test('one daily claim, atomic report publication, history and completed-run idempotency',async()=>{
 const {env,db}=await setup();try{
  const options={now:()=>now};const outcomes=await Promise.all([runDailyReview(env,now,options),runDailyReview(env,now,options)]);
  assert.deepEqual(outcomes.map(r=>r.state).sort(),['already_handled','complete']);assert.equal(db.prepare('SELECT attempts FROM agency_daily_reviews').get().attempts,1);
  assert.equal((await runDailyReview(env,now+10*60000,options)).state,'already_handled');
  const response=await dailyReviewResponse(env.TOYS_DB,null,now);assert.equal(response.reports.length,1);assert.equal(response.history.length,1);assert.equal(response.counts.healthy,1);assert.equal(response.schedule.nextRunAt,'2026-10-15T05:30:00.000Z');
  db.prepare("UPDATE projects SET status='inactive' WHERE id=?").run(project.id);assert.equal((await dailyReviewResponse(env.TOYS_DB,null,now)).reports.length,0);
 }finally{db.close();}
});
test('partial data retries are bounded and old successful data stays readable after a failed publish',async()=>{
 const {env,db}=await setup();try{
  db.prepare('DELETE FROM ads_daily_snapshots WHERE local_date=?').run(range.to);
  for(let i=0;i<4;i++)assert.equal((await runDailyReview(env,now+i*10*60000,{now:()=>now+i*10*60000})).state,'partial');
  assert.equal((await runDailyReview(env,now+40*60000,{now:()=>now+40*60000})).state,'already_handled');
  assert.equal(db.prepare('SELECT attempts FROM agency_daily_reviews').get().attempts,4);
  const saved=db.prepare('SELECT payload_json FROM agency_project_reviews').get().payload_json;
  db.exec("UPDATE agency_daily_reviews SET attempts=1,next_attempt_at=NULL");const original=env.TOYS_DB.batch;env.TOYS_DB.batch=async()=>{throw Error('Synthetic write failure');};
  assert.equal((await runDailyReview(env,now+50*60000,{now:()=>now+50*60000})).state,'error');assert.equal(db.prepare('SELECT payload_json FROM agency_project_reviews').get().payload_json,saved);env.TOYS_DB.batch=original;
 }finally{db.close();}
});
test('expired lease recovers, stale snapshots flag data health and do not masquerade as new imports',async()=>{
 const {env,db}=await setup();try{
  db.exec("INSERT INTO agency_daily_reviews VALUES('org_toys_agency','2026-10-14','running',1,NULL,NULL,'expired','2026-10-14T05:00:00Z',NULL)");
  db.exec("UPDATE ads_daily_snapshots SET checked_at='2026-10-13T05:00:00Z'");
  const run=await runDailyReview(env,now,{now:()=>now});assert.equal(run.state,'partial');const r=(await dailyReviewResponse(env.TOYS_DB,null,now)).reports[0];assert.equal(r.priority,'attention');assert.ok(r.accounts[0].issues.some(s=>s.includes('свежим импортом')));
 }finally{db.close();}
});
test('daily review API is master-only and rejects impossible history dates',async()=>{
 const {env,db}=await setup();try{
  const url='/api/v2/master/daily-review',worker=await testWorker();
  assert.equal((await worker.fetch(request(url,{role:null}),env)).status,401);assert.equal((await worker.fetch(request(url,{role:'viewer'}),env)).status,403);assert.equal((await worker.fetch(request(url),env)).status,403);
  env.MVP_EDITOR_PROJECTS+=',__master';assert.equal((await worker.fetch(request(url),env)).status,200);assert.equal((await worker.fetch(request(url+'?date=2026-02-30'),env)).status,400);
 }finally{db.close();}
});
test('CRM counts first status events in its timezone; matches only known ads and excludes deleted contacts and PII',async()=>{
 const {env,db}=await setup();try{
  db.prepare('INSERT INTO crm_projects(project_id,enabled_at,timezone,updated_at) VALUES(?,?,?,?)').run(project.id,'2026-01-01','Asia/Tbilisi','2026-01-01');
  for(const [id,kind,at,adId,deleted,currency,value] of [
   ['qualified','qualified','2026-10-12T21:00:00Z','3',null,null,null],
   ['sale','sale','2026-10-13T19:00:00Z','3',null,'CZK','100'],
   ['unmatched','sale','2026-10-13T19:00:00Z','99',null,'EUR','50'],
   ['tomorrow','qualified','2026-10-13T21:00:00Z','3',null,null,null],
   ['deleted','sale','2026-10-13T10:00:00Z','3','2026-10-14','CZK','1000']]){
   db.prepare('INSERT INTO leads(id,project_id,source_provider,external_lead_id,created_at,current_status,name,email,metadata_json,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,project.id,'manual',id,at,'Новый','Private contact','private@example.test',JSON.stringify({adAttribution:{version:1,provider:'meta_ads',accountId:'123',adId}}),deleted);
   db.prepare('INSERT INTO crm_milestones(id,project_id,lead_id,kind,occurred_at,currency,value) VALUES(?,?,?,?,?,?,?)').run(id,project.id,id,kind,at,currency,value);
  }
  const report=(await generateDailyReviews(env.TOYS_DB,reportDate,now))[0];assert.equal(report.crm.qualified,1);assert.equal(report.crm.sales,2);assert.equal(report.crm.matched,2);assert.equal(report.crm.unmatched,1);assert.deepEqual(report.crm.revenue,[{currency:'CZK',value:100},{currency:'EUR',value:50}]);assert.equal(report.findings[0].code,'crm_unmatched');assert.ok(!JSON.stringify(report).includes('private@example.test'));
 }finally{db.close();}
});
