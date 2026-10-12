import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';import {createGoogleReceiverAdapter,registerGoogleSnapshot} from '../native/google-receiver.js';
test('Google accepted snapshots supply all hierarchy levels, reject gaps and never relabel conversions as sales',async()=>{
 const{db,env}=fixture();try{
 const id='a'.repeat(64),project={id:'prj_housevip_cxp7',organizationId:'org_toys_agency'},from='2026-10-07';
 db.prepare(`INSERT INTO google_ads_receiver_batches(snapshot_id,organization_id,project_id,customer_id,login_customer_id,api_version,range_from,range_to,currency_code,time_zone,page_size,total_rows,campaign_rows,ad_group_rows,ad_rows,next_expected_offset,received_rows,status,created_at,updated_at,accepted_at) VALUES(?,?,?,?,?,'v25',?,?,'EUR','Europe/Prague',100,3,1,1,1,3,3,'accepted',?,?,?)`).run(id,project.organizationId,project.id,'2662445825','7753894623',from,from,from,from,from);
 db.prepare(`INSERT INTO google_ads_receiver_pages VALUES(?,0,?,3,0,?)`).run(id,'b'.repeat(64),from);
 for(const level of ['campaign','ad_group','ad']){const row={date:from,level,campaign:{id:'1',name:'Campaign'},adGroup:level==='campaign'?null:{id:'2',name:'Group'},ad:level==='ad'?{id:'3',name:'Creative'}:null,creative:level==='ad'?{ref:'google-ad:3'}:null,metrics:{impressions:'100',clicks:'5',costMicros:'12000001',conversions:'2',conversionValue:'100'}};db.prepare('INSERT INTO google_ads_receiver_rows VALUES(?,?,0,?,?,?,?,?,?)').run(id,level,level,from,'1',row.adGroup?.id||null,row.ad?.id||null,JSON.stringify(row));}
 const adapter=createGoogleReceiverAdapter(env.TOYS_DB),integration={accountId:'2662445825',currency:'EUR',timezone:'Europe/Prague'};
 const result=await adapter({project,integration,request:{from,to:from}});assert.equal(result.dailyMetrics[0].metrics.spend,'12.000001');assert.equal(result.campaigns[0].adGroups[0].ads[0].dailyMetrics[0].metrics.conversions,'2');assert.deepEqual(result.campaigns[0].adGroups[0].ads[0].outcomeDaily,[]);assert.equal(result.dailyMetrics[0].metrics.impressions,'100');
 await assert.rejects(adapter({project,integration,request:{from:'2026-10-06',to:from}}),{code:'google_snapshot_coverage_missing'});
 await assert.rejects(adapter({project:{...project,id:'other'},integration,request:{from,to:from}}),{code:'google_snapshot_coverage_missing'});
 await assert.rejects(adapter({project,integration:{...integration,currency:'CZK'},request:{from,to:from}}),{code:'google_snapshot_scope_mismatch'});
 await registerGoogleSnapshot(env.TOYS_DB,{projectId:project.id,customerId:integration.accountId,timeZone:integration.timezone,currencyCode:integration.currency});assert.equal(db.prepare("SELECT status FROM integrations WHERE provider='google_ads'").get().status,'active');
 db.prepare("UPDATE google_ads_receiver_batches SET status='receiving'").run();await assert.rejects(adapter({project,integration,request:{from,to:from}}),{code:'google_snapshot_coverage_missing'});
 }finally{db.close();}
});

test('unchanged authenticated delivery refreshes checked time without duplicating accepted data',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../runtime/backend.js',import.meta.url),'utf8').split('// src/google-ads-cloudrun-ingestion.js')[1].split('// src/index.js')[0];
 const {persistPage}=new Function('registerGoogleSnapshot','__name',source+';return {persistPage};')(registerGoogleSnapshot,()=>{});
 const {db,env}=fixture();try{
  const project={id:'prj_housevip_cxp7',slug:'housevip-cxp7',organizationId:'org_toys_agency'},id='e'.repeat(64);
  const payload={snapshotId:id,customer:{id:'2662445825',currencyCode:'EUR',timeZone:'Europe/Prague'},range:{from:'2026-10-12',to:'2026-10-12'},coverage:Object.fromEntries(['campaign','ad_group','ad'].map(x=>[x,{complete:true,totalRows:0}])),page:{offset:0,pageSize:200,returnedRows:0,totalRows:0,nextCursor:null},rows:[]};
  const first=await persistPage(env.TOYS_DB,payload,project,'f'.repeat(64),'2026-10-12T10:00:00.000Z');assert.equal(first.accepted,true);
  await persistPage(env.TOYS_DB,payload,project,'f'.repeat(64),'2026-10-12T10:21:00.000Z');
  const stored=db.prepare('SELECT accepted_at,updated_at FROM google_ads_receiver_batches').get();assert.equal(stored.accepted_at,'2026-10-12T10:00:00.000Z');assert.equal(stored.updated_at,'2026-10-12T10:21:00.000Z');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM google_ads_receiver_pages').get().n,1);
  const result=await createGoogleReceiverAdapter(env.TOYS_DB)({project,integration:{accountId:'2662445825',currency:'EUR',timezone:'Europe/Prague'},request:{from:'2026-10-12',to:'2026-10-12'}});assert.equal(result.sourceFetchedAt,stored.updated_at);
  await assert.rejects(persistPage(env.TOYS_DB,payload,project,'a'.repeat(64),'2026-10-12T11:00:00.000Z'),{code:'replay_conflict'});assert.equal(db.prepare('SELECT updated_at FROM google_ads_receiver_batches').get().updated_at,stored.updated_at);
 }finally{db.close();}
});


test('accepted Google snapshots activate pending setup, preserve config and never re-enable disabled integrations',async()=>{
 const {db,env}=fixture();try{
  const batch={projectId:'prj_housevip_cxp7',customerId:'9632942627',timeZone:'Europe/Prague',currencyCode:'CZK'};
  db.prepare("INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES('existing',?,'google_ads',?,'pending',?)").run(batch.projectId,batch.customerId,JSON.stringify({customField:'keep',expectedCurrency:'USD'}));
  await registerGoogleSnapshot(env.TOYS_DB,batch);
  const row=db.prepare("SELECT id,status,config_json FROM integrations WHERE id='existing'").get();assert.equal(row.status,'active');assert.equal(JSON.parse(row.config_json).expectedCurrency,'CZK');assert.equal(JSON.parse(row.config_json).customField,'keep');assert.equal(db.prepare("SELECT COUNT(*) AS n FROM integrations WHERE provider='google_ads'").get().n,1);
  db.prepare("UPDATE integrations SET status='disabled' WHERE id='existing'").run();await registerGoogleSnapshot(env.TOYS_DB,batch);assert.equal(db.prepare("SELECT status FROM integrations WHERE id='existing'").get().status,'disabled');
 }finally{db.close();}
});

test('compact Google delivery stores a complete page once and preserves every hierarchy row and metric',async()=>{
 const{readFileSync}=await import('node:fs');const source=readFileSync(new URL('../runtime/backend.js',import.meta.url),'utf8').split('// src/google-ads-cloudrun-ingestion.js')[1].split('// src/index.js')[0];
 const{persistPage}=new Function('registerGoogleSnapshot','__name',source+';return {persistPage};')(registerGoogleSnapshot,()=>{});
 const{db,env}=fixture();try{
 const project={id:'prj_housevip_cxp7',slug:'housevip-cxp7',organizationId:'org_toys_agency'},date='2026-10-12';
 const rows=['campaign','ad_group','ad'].map(level=>({level,date,campaign:{id:'1',name:'C'},adGroup:level==='campaign'?null:{id:'2',name:'G'},ad:level==='ad'?{id:'3',name:'A'}:null,creative:level==='ad'?{ref:'google-ad:3'}:null,metrics:{impressions:'100',clicks:'5',costMicros:'12000001',conversions:'2',conversionValue:'100'}}));
 const payload={snapshotId:'c'.repeat(64),customer:{id:'2662445825',currencyCode:'EUR',timeZone:'Europe/Prague'},range:{from:date,to:date},coverage:Object.fromEntries(['campaign','ad_group','ad'].map(l=>[l,{complete:true,totalRows:1}])),page:{offset:0,pageSize:200,returnedRows:3,totalRows:3,nextCursor:null},rows};
 const accepted=await persistPage(env.TOYS_DB,payload,project,'d'.repeat(64),date+'T12:00:00Z');assert.equal(accepted.accepted,true);assert.equal(accepted.persistedRows,3);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM google_ads_receiver_rows').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM google_ads_receiver_row_pages').get().n,1);
 const data=await createGoogleReceiverAdapter(env.TOYS_DB)({project,integration:{accountId:'2662445825',currency:'EUR',timezone:'Europe/Prague'},request:{from:date,to:date}});
 assert.equal(data.dailyMetrics[0].metrics.spend,'12.000001');assert.equal(data.campaigns[0].adGroups[0].ads[0].dailyMetrics[0].metrics.conversions,'2');
 await persistPage(env.TOYS_DB,payload,project,'d'.repeat(64),date+'T12:20:00Z');assert.equal(db.prepare('SELECT COUNT(*) n FROM google_ads_receiver_row_pages').get().n,1);
 }finally{db.close();}
});
