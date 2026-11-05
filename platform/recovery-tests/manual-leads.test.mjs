import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,testWorker} from './fixture.mjs';import {seedManualLeads} from './manual-leads-fixture.mjs';import {roleBrowserFixture} from './roles-browser-fixture.mjs';
import {advertisingModel,aggregate} from '../unified/model.js';
import {overviewMarkup} from '../master/overview.js';
const worker=await testWorker(),base='/api/v2/projects/murmur-up8m';
async function setup(){const f=fixture(),tokens=roleBrowserFixture(f.env,f.db);await seedManualLeads(f.env,f.db);for(const who of ['team','client'])f.db.prepare('INSERT INTO project_memberships(project_id,user_id,role) VALUES(?,?,?)').run('prj_murmur_up8m','role-'+who,who==='team'?'buyer':'client_manager');const call=(who,path,body,key=crypto.randomUUID(),origin='https://test.local')=>worker.fetch(new Request('https://test.local'+path,{method:body?'PUT':'GET',headers:{...(who?{cookie:'__Host-toys_session='+tokens[who]}:{}),origin,'content-type':'application/json','x-idempotency-key':key},...(body?{body:JSON.stringify(body)}:{})}),f.env,{});return {...f,call};}
test('Murmur staff can save counts; clients, strangers and other project scopes cannot write',async()=>{
 const {db,call}=await setup();try{const path=base+'/manual-lead-counts',body={date:'2026-11-04',count:8,bookings:2,version:0};
 for(const who of [null,'empty','client'])assert.equal((await call(who,path,body)).status,who?403:401);
 assert.equal((await call('team',path,body,'cross','https://evil.test')).status,403);
 assert.equal((await call('team','/api/v2/projects/housevip-cxp7/manual-lead-counts',body)).status,404);
 const response=await call('team',path,body,'create');assert.equal(response.status,200,await response.clone().text());
 const client=await(await call('client',path+'?from=2026-11-04&to=2026-11-04')).json();assert.equal(client.canEdit,false);assert.equal(client.total,8);assert.equal(client.bookingTotal,2);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM leads WHERE project_id='prj_murmur_up8m'").get().n,0);assert.equal(db.prepare("SELECT COUNT(*) n FROM crm_delivery WHERE project_id='prj_murmur_up8m'").get().n,0);
 }finally{db.close();}
});
test('same-day saves replace counts, retries do not duplicate them, stale versions are rejected and zero clears both totals',async()=>{
 const {db,call}=await setup();try{const path=base+'/manual-lead-counts',body={date:'2026-11-04',count:8,bookings:2,version:0};
 const a=await(await call('admin',path,body,'one')).json();assert.deepEqual(await(await call('admin',path,body,'one')).json(),a);
 assert.equal((await call('admin',path,{...body,count:99},'one')).status,409);
 assert.equal((await call('team',path,body,'stale')).status,409);
 assert.equal((await call('team',path,{...body,count:10,bookings:3,version:1})).status,200);
 const updated=await(await call('admin',path+'?from=2026-11-04&to=2026-11-04')).json();assert.equal(updated.total,10);assert.equal(updated.bookingTotal,3);assert.equal(updated.entries.length,1);
 assert.equal((await call('team',path,{...body,count:0,bookings:0,version:2})).status,200);
 const cleared=await(await call('admin',path+'?from=2026-11-04&to=2026-11-04')).json();assert.equal(cleared.total,0);assert.equal(cleared.bookingTotal,0);assert.equal(cleared.entries[0].version,3);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='manual_leads.saved'").get().n,3);
 }finally{db.close();}
});
test('manual leads affect overview and campaigns once; booking cost uses the same-period ad spend, not qualifications',async()=>{
 const {db,call}=await setup();try{
 await call('admin',base+'/manual-lead-counts',{date:'2026-11-04',count:8,bookings:2,version:0});
 const range={from:'2026-11-04',to:'2026-11-04'},d=await(await call('admin',base+'/ads-summary?'+new URLSearchParams(range))).json();assert.equal(d.ok,true,JSON.stringify(d));assert.equal(d.manualLeadCounts.bookingTotal,2);
 const model=aggregate(advertisingModel({},d,range));assert.equal(model.conversions,13);assert.equal(model.money[0].spend,1000);assert.equal(model.clicks,20);
 const tree=await(await call('admin',base+'/campaign-browser?'+new URLSearchParams({...range,dataset:'1'}))).json();assert.equal(tree.ok,true);assert.equal(tree.rows.reduce((s,r)=>s+r.metrics.conversions,0),13);assert.equal(tree.rows.find(r=>r.manual).metrics.cpa,null);
 const summary=await(await call('admin','/api/v2/master/projects/murmur-up8m/summary?'+new URLSearchParams(range))).json();assert.equal(summary.ads[0].conversions,13);assert.equal(summary.manualLeadCounts.bookingTotal,2);
 const view=overviewMarkup({projects:[{slug:'murmur-up8m',name:'MurMur'}],summaries:new Map([['murmur-up8m',summary]]),slug:'murmur-up8m'});assert.match(view.metrics,/Стоимость записи/);assert.match(view.metrics,/500/);
 const outside=await(await call('admin',base+'/manual-lead-counts?from=2026-11-03&to=2026-11-03')).json();assert.equal(outside.total,0);assert.equal(outside.bookingTotal,0);
 }finally{db.close();}
});
test('bad counts and dates never change data; missing Meta stays unknown while manual counts remain visible',async()=>{
 const {db,call}=await setup();try{const body={date:'2026-11-04',count:1,bookings:1,version:0};for(const change of [{count:-1},{count:1.5},{bookings:-1},{bookings:'2'},{date:'2026-02-30'},{date:'2999-01-01'},{version:-1}])assert.equal((await call('admin',base+'/manual-lead-counts',{...body,...change})).status,400);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM manual_lead_counts').get().n,0);
 const r=advertisingModel({}, {providers:[],manualLeadCounts:{entries:[{date:'2026-11-04',count:3,bookings:1}],total:3,bookingTotal:1,currency:'CZK'}},{from:'2026-11-04',to:'2026-11-04'});assert.equal(r[0].manualCount,3);assert.equal(aggregate(r).conversions,null);assert.equal(aggregate(r).money[0].spend,null);
 }finally{db.close();}
});
