import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {parseMonoreyConversions,publishMonoreyConversions,attachMonoreyConversions,syncMonoreyConversions,runMonoreyConversions} from '../imports/monorey-report.js';
import {advertisingModel} from '../unified/model.js';
const header=['date','platform','account_name','account_id','currency','campaign','impressions','clicks','cost','conversions','conv_value'];
const row=(date='2026-10-30',count=2)=>[date,'Meta Ads','Synthetic','act_1139444467187528','EUR','Campaign',100,10,5,count,null];
const metric=value=>({state:'observed',value:String(value)});
const day=(date,value)=>({date,metrics:{conversions:metric(value),spend:metric(5),clicks:metric(10),impressions:metric(100)}});
test('manual report supports explicit zero, blanks and typed dates; duplicate or foreign scopes fail closed',()=>{
 assert.deepEqual(parseMonoreyConversions([header,row('2026-10-30',0),row('2026-10-31',null)]),[{date:'2026-10-30',campaign:'Campaign',conversions:0}]);
 assert.equal(parseMonoreyConversions([header,row('10/30/2026')])[0].date,'2026-10-30');
 for(const change of [r=>r[3]='other',r=>r[9]=-1,r=>r[9]='two']){const r=row();change(r);assert.throws(()=>parseMonoreyConversions([header,r]));}
 assert.throws(()=>parseMonoreyConversions([header,row(),row()]));
});
test('report totals replace Meta once at campaign level, preserve raw snapshots and never allocate leads to ads',async()=>{
 const {env,db}=fixture();try{
 db.exec("INSERT INTO projects(id,organization_id,slug,name,status) VALUES('prj_monorey_acdk','org_toys_agency','monorey-acdk','Synthetic','active')");
 const rows=parseMonoreyConversions([header,row()]);await publishMonoreyConversions(env.TOYS_DB,rows,'2026-11-05T10:00:00Z');
 const provider={provider:'meta_ads',integrationId:'int_monorey_meta',coveredDates:['2026-10-30'],requestedRange:{from:'2026-10-30',to:'2026-10-30'},hierarchy:{providerId:'1139444467187528',currency:'EUR',dailyMetrics:[day('2026-10-30',1)],children:[{name:'Campaign',providerId:'123',dailyMetrics:[day('2026-10-30',1)],children:[{providerId:'group',dailyMetrics:[day('2026-10-30',1)],children:[]}]}]}};
 const original=JSON.stringify(provider),request={projectSlug:'monorey-acdk',from:'2026-10-30',to:'2026-10-30'},data=await attachMonoreyConversions(env.TOYS_DB,request,{providers:[provider]});
 assert.equal(JSON.stringify(provider),original);assert.equal(data.providers[0].hierarchy.children[0].dailyMetrics[0].metrics.conversions.value,'2');assert.equal(data.providers[0].hierarchy.children[0].children[0].dailyMetrics[0].metrics.conversions.value,'1');
 const normalized=advertisingModel({},data,request);assert.equal(normalized[0].conversions,2);assert.equal(normalized[0].spend,5);
 const other=await attachMonoreyConversions(env.TOYS_DB,{...request,projectSlug:'other'},{providers:[provider]});assert.equal(other.providers[0],provider);
 await publishMonoreyConversions(env.TOYS_DB,[{...rows[0],conversions:9}],'2026-11-05T09:00:00Z');assert.equal((await attachMonoreyConversions(env.TOYS_DB,request,{providers:[provider]})).reportConversions[0].conversions,2);
 const failed=await syncMonoreyConversions(env,{fetchImpl:async()=>new Response('broken'),now:()=>new Date('2026-11-05T10:05:00Z')});assert.equal(failed.ok,false);
 const lastGood=await attachMonoreyConversions(env.TOYS_DB,request,{providers:[provider]});assert.equal(lastGood.reportConversions[0].conversions,2);assert.equal(lastGood.manualReport.status,'error');
 }finally{db.close();}
});
test('bounded CSV sync imports beyond the Profkit parser default of forty rows',async()=>{
 const {env,db}=fixture();try{db.exec("INSERT INTO projects(id,organization_id,slug,name,status) VALUES('prj_monorey_acdk','org_toys_agency','monorey-acdk','Synthetic','active')");
 const rows=[header,...Array.from({length:60},(_,i)=>{const r=row();r[5]='Campaign '+i;return r;})],csv=rows.map(r=>r.map(v=>JSON.stringify(String(v??''))).join(',')).join('\n');
 const result=await syncMonoreyConversions(env,{fetchImpl:async url=>{assert.match(url,/gid=2022069134/);return new Response(csv);}});assert.equal(result.ok,true);assert.equal(result.rows,60);
 }finally{db.close();}
});
test('an explicitly queued report read runs once between regular refresh slots',async()=>{
 const {env,db}=fixture(),original=globalThis.fetch;try{
 db.exec("INSERT INTO projects(id,organization_id,slug,name,status) VALUES('prj_monorey_acdk','org_toys_agency','monorey-acdk','Synthetic','active')");
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response([header,row()].map(r=>r.map(v=>JSON.stringify(String(v??''))).join(',')).join('\n'));};
 const at=Date.parse('2026-11-05T11:47:00Z');assert.equal((await runMonoreyConversions(env,at)).status,'not_due');assert.equal(calls,0);
 await publishMonoreyConversions(env.TOYS_DB,parseMonoreyConversions([header,row()]),'2026-11-05T10:00:00Z');db.exec("UPDATE report_conversion_state SET status='pending'");
 assert.equal((await runMonoreyConversions(env,at)).ok,true);assert.equal(calls,1);assert.equal((await runMonoreyConversions(env,at)).status,'not_due');assert.equal(calls,1);
 }finally{globalThis.fetch=original;db.close();}
});
