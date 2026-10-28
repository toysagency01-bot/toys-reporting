// Read-only reconciliation of the user's 20–26 October Ads Manager example.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readAdsSnapshot} from '../imports/ads-store.js';
import {advertisingModel,aggregate} from '../unified/model.js';
import {summary} from '../crm/service.js';
import {qualificationCost} from '../native/qualification-cost.js';
const query=(sql,params=[])=>new Promise((resolve,reject)=>{
 const p=spawn('python',['recovery-tests/read-only-d1.py']);let out='',err='';
 p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);
 p.on('close',code=>{if(code)reject(new Error(err));else{try{resolve(JSON.parse(out));}catch(e){reject(e);}}});
 p.stdin.end(JSON.stringify({sql,params}));
});
class Statement{
 constructor(sql){this.sql=sql;this.params=[];}
 bind(...params){this.params=params;return this;}
 async first(){return (await query(this.sql,this.params)).results[0]||null;}
 all(){return query(this.sql,this.params);}
 run(){throw new Error('Remote writes disabled');}
}
const db={prepare:sql=>new Statement(sql)};
const scope=(await query("SELECT p.organization_id AS organizationId,p.id AS projectId,p.slug AS projectSlug,i.id AS integrationId,i.provider,i.external_account_id AS accountId,json_extract(i.config_json,'$.accountTimezone') AS timezone,json_extract(i.config_json,'$.expectedCurrency') AS currency FROM integrations i JOIN projects p ON p.id=i.project_id WHERE i.id='int_visa_meta' AND p.id='prj_visa_agency_qa3b'")).results[0];
assert.ok(scope);const range={from:'2026-10-20',to:'2026-10-26'};
const provider=await readAdsSnapshot(db,scope,range.from,range.to);
assert.equal(provider.coverage,'complete');
assert.equal(provider.freshness,'fresh');assert.equal(provider.refresh.errorCode,null);
const campaign=provider.hierarchy.children.find(c=>c.providerId==='120248991944630056');assert.ok(campaign);
const rows=advertisingModel(null,{providers:[provider]},range),totals=aggregate(rows);
const crm=await summary({TOYS_DB:db},{id:scope.projectId,slug:scope.projectSlug},range.from,range.to),cost=qualificationCost(rows,crm);
assert.equal(crm.coverage.sourceFilter.utm_source,'toys');assert.ok(crm.qualified>0);assert.ok(cost);assert.equal(cost.currency,scope.currency);assert.equal(cost.value,totals.money[0].spend/crm.qualified);
const campaignTotal=campaign.dailyMetrics.reduce((n,d)=>n+Number(d.metrics.conversions.value),0);
assert.equal(campaignTotal,13,'The 13 scheduled meetings must appear in the campaign');
const audit=(await query("SELECT status,details_json FROM sync_runs WHERE project_id='prj_visa_agency_qa3b' AND job_type='meta-account-reconciliation' ORDER BY id DESC LIMIT 1")).results[0];
const details=JSON.parse(audit.details_json);assert.equal(details.comparisonLevel,'adset');
const verifiedDays=details.daily.filter(d=>d.date>=range.from&&d.date<=range.to);
assert.equal(verifiedDays.length,7);assert.ok(verifiedDays.every(d=>d.matched),'Every requested day must pass independent reconciliation');
const groups=campaign.children.map(g=>details.resultMapping.adsets[g.providerId]);assert.ok(groups.some(g=>g?.name==='invitee_meeting_scheduled'));
console.log(JSON.stringify({range,campaign:{name:campaign.name,conversions:campaignTotal,events:[...new Set(groups.map(g=>g?.name).filter(Boolean))]},dashboardConversions:totals.conversions,qualifiedCRM:crm.qualified,qualificationCost:cost,spend:totals.money,independentReconciliation:'matched_for_requested_period',otherUnmatchedDates:details.daily.filter(d=>!d.matched).map(d=>d.date),fetchedAt:provider.fetchedAt}));
