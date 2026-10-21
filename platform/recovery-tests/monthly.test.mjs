import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
import {seedMonthly} from './monthly-fixture.mjs';
import {roleBrowserFixture} from './roles-browser-fixture.mjs';
import {rowMetrics,reportTotals} from '../monthly/model.js';
const worker=await testWorker(),path='/api/v2/projects/bs-clinic-a5b4/monthly-reports';
function setup(){const f=fixture();f.id=seedMonthly(f.db);f.env.MVP_VIEW_PROJECTS+=',bs-clinic-a5b4';f.env.MVP_EDITOR_PROJECTS+=',bs-clinic-a5b4,__master';return f;}
function call(f,suffix='',method='GET',body=null,options={}){return worker.fetch(new Request('https://test.local'+path+suffix,{method,headers:{authorization:'Bearer synthetic-local-editor-token',origin:'https://test.local','content-type':'application/json','x-idempotency-key':options.key||crypto.randomUUID(),...options.headers},...(body?{body:JSON.stringify(body)}:{})}),f.env);}
test('monthly totals use matched, known results; zero and missing remain distinct',()=>{
 const rows=[{spend:1000,clicks:100,leads:10,appointments:2,patients:1,revenue:500},{spend:2000,clicks:200,leads:20,appointments:null,patients:null,revenue:null}];const totals=reportTotals(rows);
 assert.equal(totals.appointments,2);assert.equal(totals.appointmentCost,500);assert.equal(totals.patientCost,1000);assert.equal(totals.coverage.appointments,1);assert.equal(totals.cpl,100);assert.equal(totals.appointmentRate,20);
 assert.equal(reportTotals([{spend:90036-817,leads:628},{spend:817,leads:null}]).cpl,90036/628);
 assert.equal(rowMetrics({spend:1000,appointments:0,patients:null}).appointmentCost,null);assert.equal(reportTotals([{appointments:null}]).appointments,null);assert.equal(reportTotals([{appointments:0}]).appointments,0);
});
test('monthly collection imports all periods, preserves source notes and rejects other projects and anonymous readers',async()=>{
 const f=setup(),d=await(await call(f)).json();assert.equal(d.reports.length,12);assert.equal(d.reports[0].to,'2026-09-14');assert.equal(d.reports[0].rows[0].sourceAnnotations.patients,'3(12)');assert.equal(d.reports[0].rows[0].deferredLeads,12);assert.equal(d.reports[0].rows[0].patientCost,1000/3);
 assert.equal((await worker.fetch(request('/api/v2/projects/housevip-cxp7/monthly-reports'),f.env)).status,404);
 assert.equal((await call(f,'','GET',null,{headers:{authorization:''}})).status,401);f.db.close();
});
test('assigned client edits only business results; team needs project assignment; retries and conflicts preserve data',async()=>{
 const f=setup(),tokens=roleBrowserFixture(f.env,f.db),headers=role=>({cookie:'__Host-toys_session='+tokens[role]});
 assert.equal((await call(f,'','GET',null,{headers:headers('client')})).status,403);
 f.db.prepare("INSERT INTO project_memberships(project_id,user_id,role) VALUES('prj_bs_clinic_a5b4','role-client','client_manager')").run();
 const id='/'+f.id,key=crypto.randomUUID(),body={version:1,rows:[{id:'r1',appointments:4,patients:2,deferredLeads:100,revenue:900}]};
 const save=await call(f,id,'PATCH',body,{headers:headers('client'),key});assert.equal(save.status,200);const d=await save.json();assert.equal(d.report.version,2);assert.equal(d.report.rows[0].patientCost,500);assert.equal(d.report.rows[0].deferredLeads,100);assert.equal(d.report.totals.patients,2);assert.equal(d.report.rows[0].appointmentCost,250);assert.equal(d.report.rows[0].sourceAnnotations.patients,'3(12)');assert.equal(d.report.rows[0].unconfirmed.patients,undefined);assert.equal(d.permissions.canManageReports,false);
 assert.equal((await call(f,id,'PATCH',body,{headers:headers('client'),key})).status,200);
 assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='monthly.updated'").get().n,1);
 assert.equal((await call(f,id,'PATCH',body,{headers:headers('client')})).status,409);
 assert.equal((await call(f,id,'PATCH',{version:2,rows:[{id:'r1',spend:1}]},{headers:headers('client')})).status,403);
 assert.equal((await call(f,'','POST',{from:'2026-09-15',to:'2026-10-14'},{headers:headers('client')})).status,403);
 assert.equal((await call(f,id,'PATCH',{version:2,rows:[{id:'r1',patients:-1}]},{headers:headers('client')})).status,400);
 assert.equal((await call(f,id,'PATCH',{version:2,rows:[{id:'r1',patients:1.5}]},{headers:headers('client')})).status,400);
 assert.equal((await call(f,id,'PATCH',{version:2,rows:[{id:'r1',patients:3}]},{headers:{...headers('client'),origin:'https://evil.test'}})).status,403);
 assert.equal((await call(f,'','GET',null,{headers:headers('team')})).status,403);
 f.db.prepare("INSERT INTO project_memberships(project_id,user_id,role) VALUES('prj_bs_clinic_a5b4','role-team','buyer')").run();
 assert.equal((await call(f,'','GET',null,{headers:headers('team')})).status,200);
 assert.equal((await call(f,id,'PATCH',{version:2,rows:[],summary:'New summary'},{headers:headers('team')})).status,200);
 const current=await(await call(f,id,'GET',null,{headers:headers('client')})).json();assert.equal(current.report.rows[0].patients,2);assert.equal(current.report.summary,'New summary');assert.equal(current.report.version,3);f.db.close();
});
test('staff creates a new saved month without copying previous advertising/results or calling providers',async()=>{
 const f=setup(),key=crypto.randomUUID(),body={from:'2026-09-15',to:'2026-10-14'};
 const response=await call(f,'','POST',body,{key});assert.equal(response.status,201);const d=await response.json();assert.equal(d.report.rows.length,2);assert.equal(d.report.rows[0].spend,null);assert.equal(d.report.rows[0].patients,null);assert.equal(d.report.source.kind,'saved_advertising');
 assert.equal((await call(f,'','POST',body,{key})).status,200);assert.equal((await call(f,'','POST',body)).status,409);assert.equal(f.db.prepare('SELECT count(*) AS n FROM project_monthly_reports').get().n,13);f.db.close();
});
test('simultaneous retries of a monthly save commit one revision and one audit event',async()=>{
 const f=setup(),key=crypto.randomUUID(),body={version:1,rows:[{id:'r1',appointments:5}]};
 // D1 serializes atomic batches; the synchronous SQLite fixture needs that queue.
 const batch=f.env.TOYS_DB.batch.bind(f.env.TOYS_DB);let queue=Promise.resolve();f.env.TOYS_DB.batch=statements=>{const next=queue.then(()=>batch(statements));queue=next.catch(()=>{});return next;};
 const responses=await Promise.all([call(f,'/'+f.id,'PATCH',body,{key}),call(f,'/'+f.id,'PATCH',body,{key})]);assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal(f.db.prepare('SELECT version FROM project_monthly_reports WHERE id=?').get(f.id).version,2);assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='monthly.updated'").get().n,1);f.db.close();
});
test('new monthly snapshots use only stored campaign-level CZK metrics, deduplicate scopes and leave unique reach unknown',async()=>{
 const f=setup();f.db.prepare("INSERT INTO integrations(id,project_id,provider,external_account_id,status) VALUES('monthly-meta','prj_bs_clinic_a5b4','meta_ads','123','active')").run();
 const observed=value=>({state:'observed',value:String(value)}),payload=(date,spend)=>JSON.stringify({hierarchy:{currency:'CZK',children:[{providerId:'1234',name:'Stored campaign',dailyMetrics:[{date,metrics:{spend:observed(spend),clicks:observed(10),conversions:observed(2)}}]}]}});
 for(const [scope,date,spend,checked]of [['old','2026-09-15',900,'2026-09-16'],['new','2026-09-15',100,'2026-09-17'],['new','2026-09-16',150,'2026-09-17']])f.db.prepare("INSERT INTO ads_daily_snapshots(scope_key,local_date,organization_id,project_id,integration_id,provider,payload_json,content_hash,checked_at) VALUES(?,?,'org_toys_agency','prj_bs_clinic_a5b4','monthly-meta','meta_ads',?,'hash',?)").run(scope,date,payload(date,spend),checked);
 const response=await call(f,'','POST',{from:'2026-09-15',to:'2026-10-14'});assert.equal(response.status,201);const d=await response.json(),row=d.report.rows[0];assert.equal(d.report.rows.length,1);assert.equal(row.name,'Stored campaign');assert.equal(row.spend,250);assert.equal(row.leads,4);assert.equal(row.cpl,62.5);assert.equal(row.reach,null);assert.equal(row.patients,null);assert.equal(d.report.source.coveredDates.length,2);f.db.close();
});

test('deferred leads are reported separately and never enter patient costs or conversions',()=>{const row=rowMetrics({spend:9798,appointments:15,patients:3,deferredLeads:12}),totals=reportTotals([row]);assert.equal(row.patientCost,3266);assert.equal(row.patientRate,20);assert.equal(totals.patients,3);assert.equal(totals.deferredLeads,12);assert.equal(totals.patientCost,3266);const changed=rowMetrics({...row,deferredLeads:500});assert.equal(changed.patientCost,3266);assert.equal(changed.patientRate,20);});
