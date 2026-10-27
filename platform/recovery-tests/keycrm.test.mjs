import test from 'node:test';
import assert from 'node:assert/strict';
import {keyCRMClient,visaKeyCRM,reconcileKeyCRMSnapshot,keyCRMQualificationTotals} from '../crm/keycrm.js';
const mapping={pipelineId:'1',qualifiedStatusIds:['10','11','12']};
const card=(id,status=10,created='2026-10-10 22:30:00')=>({id,pipeline_id:1,status_id:status,created_at:created,contact:{email:'private@example.test'}});
const page=(data,extra={})=>Response.json({data,current_page:1,last_page:1,total:data.length,...extra});
const client=fetcher=>keyCRMClient('synthetic-key',{fetcher,wait:async()=>{}});
test('KeyCRM discovery resolves all three exact labels within one unique pipeline',async()=>{
 const calls=[];
 const c=client(async(url,options)=>{
  calls.push([url,options]);const path=new URL(url).pathname;
  if(path==='/v1/pipelines')return page([{id:1},{id:2}]);
  return page(path.includes('/1/')?visaKeyCRM.qualifiedLabels.map((name,i)=>({id:10+i,title:name})):[{id:20,title:'Новый'}]);
 });
 assert.deepEqual(await c.discover(),{...mapping,qualifiedLabels:[...visaKeyCRM.qualifiedLabels]});
 assert.equal(calls.length,3);assert.ok(calls.every(([u,o])=>u.startsWith('https://openapi.keycrm.app/v1/')&&o.method==='GET'&&o.redirect==='manual'));
 assert.ok(calls.every(([,o])=>o.headers.authorization==='Bearer synthetic-key'));
});
test('KeyCRM discovery refuses an ambiguous pipeline or missing status',async()=>{
 for(const ambiguous of [true,false]){
  const c=client(async url=>new URL(url).pathname==='/v1/pipelines'?page([{id:1},{id:2}]):page(visaKeyCRM.qualifiedLabels.slice(0,ambiguous?3:2).map((name,i)=>({id:10+i,title:name}))));
  await assert.rejects(c.discover(),{code:ambiguous?'keycrm_ambiguous_pipeline':'keycrm_statuses_not_found'});
 }
});
test('KeyCRM snapshot paginates locally, scopes cards and discards contact fields',async()=>{
 const calls=[];const c=client(async url=>{
  const u=new URL(url);calls.push(u);return u.searchParams.get('page')==='1'?page([card(1)],{last_page:2,total:2}):page([card(2,15)],{current_page:2,last_page:2,total:2});
 });
 const rows=await c.snapshot(mapping);
 assert.equal(rows.length,2);assert.equal(rows[0].receivedAt,'2026-10-10T22:30:00.000Z');assert.equal(rows[0].qualified,true);assert.equal(rows[1].qualified,false);
 assert.equal(calls[0].searchParams.get('filter[pipeline_id]'),'1');assert.ok(!JSON.stringify(rows).includes('private'));
 const wrong=client(async()=>page([{...card(1),pipeline_id:2}]));await assert.rejects(wrong.snapshot(mapping),{code:'keycrm_pipeline_mismatch'});
});
test('KeyCRM incomplete/changing/duplicate pages fail without returning partial totals',async()=>{
 for(const mode of ['missing','duplicate','changing','budget']){
  const c=keyCRMClient('synthetic-key',{wait:async()=>{},maxPages:mode==='budget'?1:10,fetcher:async url=>{
   const n=Number(new URL(url).searchParams.get('page'));
   if(mode==='missing')return page([card(1)],{total:2});
   return page([card(mode==='duplicate'?1:n)],{current_page:n,last_page:2,total:mode==='changing'&&n===2?3:2});
  }});
  await assert.rejects(c.snapshot(mapping),{code:mode==='missing'?'keycrm_incomplete_snapshot':mode==='budget'?'keycrm_page_budget_exceeded':'keycrm_snapshot_changed'});
 }
});
test('KeyCRM safe errors never return provider payloads or credential-bearing exceptions',async()=>{
 for(const status of [401,403,429,500]){
  const c=client(async()=>new Response('synthetic-key private provider message',{status}));
  await assert.rejects(c.snapshot(mapping),e=>!e.message.includes('synthetic-key')&&!e.message.includes('private'));
 }
 const c=client(async()=>{throw new Error('synthetic-key');});await assert.rejects(c.snapshot(mapping),{code:'keycrm_connection_failed'});
});
test('KeyCRM same card across qualified statuses counts once on intake date in project timezone',async()=>{
 const n='2026-10-26T12:00:00Z',projectId=visaKeyCRM.projectId;
 const c=client(async()=>page([card(1)]));const rows=await c.snapshot(mapping);
 const first=reconcileKeyCRMSnapshot([],rows,{observedAt:n,projectId});
 const again=reconcileKeyCRMSnapshot(first,[{...rows[0],statusId:'11'}],{observedAt:'2026-10-27T12:00:00Z',projectId});
 assert.equal(again[0].firstQualifiedObservedAt,n);
 const totals=(from,to,timeZone)=>keyCRMQualificationTotals(again,{projectId,from,to,timeZone});
 assert.equal(totals('2026-10-11','2026-10-11','Europe/Warsaw').qualified,1);
 assert.equal(totals('2026-10-10','2026-10-10','Europe/Warsaw').qualified,0);
 assert.equal(totals('2026-10-10','2026-10-10','UTC').qualified,1);
 assert.equal(totals('2026-10-26','2026-10-27','Europe/Warsaw').qualified,0);
 assert.equal(totals('2026-10-11','2026-10-11','Europe/Warsaw').historicalStatusCoverage,'observed_only');
 const reverted=reconcileKeyCRMSnapshot(again,[{...rows[0],statusId:'15',qualified:false}],{observedAt:n,projectId});assert.equal(reverted[0].firstQualifiedObservedAt,n);
 const absent=reconcileKeyCRMSnapshot(reverted,[],{observedAt:n,projectId});assert.equal(absent[0].present,false);assert.equal(absent[0].firstQualifiedObservedAt,n);
});
test('KeyCRM rejects cross-project ledgers, changed intake dates and duplicate card identities',()=>{
 const options={projectId:visaKeyCRM.projectId,observedAt:'2026-10-26T12:00:00Z'},row={cardId:'1',receivedAt:'2026-10-10T12:00:00.000Z',qualified:true};
 const first=reconcileKeyCRMSnapshot([], [row],options);
 assert.throws(()=>reconcileKeyCRMSnapshot(first,[{...row,receivedAt:'2026-10-11T12:00:00.000Z'}],options),{code:'keycrm_intake_changed'});
 assert.throws(()=>reconcileKeyCRMSnapshot(first,[row,row],options),{code:'keycrm_duplicate_card'});
 assert.throws(()=>reconcileKeyCRMSnapshot(first,[row],{...options,projectId:'another'}),{code:'keycrm_ledger_scope_mismatch'});
});
test('KeyCRM rejects malformed dates before an import can publish fabricated cohorts',async()=>{
 for(const value of ['unknown','2026-02-30 12:00:00']){
  const c=client(async()=>page([card(1,10,value)]));await assert.rejects(c.snapshot(mapping),{code:'keycrm_invalid_created_at'});
 }
});
test('KeyCRM incremental reads send verified status filters and reject ignored scope or deleted cards',async()=>{
 let query;
 const c=client(async url=>{query=new URL(url).searchParams;return page([card(1)]);});
 const result=await c.cardsPage(mapping);assert.equal(result.total,1);assert.equal(result.done,true);assert.equal(query.get('filter[status_id]'),'10,11,12');
 for(const row of [card(1,15),{...card(1),deleted_at:'2026-10-27 12:00:00'}])await assert.rejects(client(async()=>page([row])).cardsPage(mapping),{code:'keycrm_scope_mismatch'});
});
