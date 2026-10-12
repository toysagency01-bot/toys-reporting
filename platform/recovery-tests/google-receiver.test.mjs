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
