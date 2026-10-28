// Working database, SELECT-only: actual CRM summary and campaign presentation.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {summary} from '../crm/service.js';
import {readAdsSnapshot} from '../imports/ads-store.js';
import {campaignIndex,campaignPage,campaignDataset} from '../native/campaign-model.js';
import {attachCampaignQualifications} from '../native/campaign-crm.js';
import {datasetPage} from '../native/campaign-dataset.js';
const query=(sql,params=[])=>new Promise((resolve,reject)=>{
 const p=spawn('python',['recovery-tests/read-only-d1.py']);let out='',error='';
 p.stdout.on('data',s=>out+=s);p.stderr.on('data',s=>error+=s);p.on('error',reject);p.on('close',code=>{if(code)reject(Error(error));else{try{resolve(JSON.parse(out));}catch(e){reject(e);}}});p.stdin.end(JSON.stringify({sql,params}));
});
class Statement{
 constructor(sql){this.sql=sql;this.params=[];}bind(...params){this.params=params;return this;}
 async first(){return (await query(this.sql,this.params)).results[0]||null;}
 all(){return query(this.sql,this.params);}run(){throw Error('Remote writes disabled');}
}
const db={prepare:sql=>new Statement(sql)},project={id:'prj_visa_agency_qa3b',slug:'visa-agency-qa3b'},range={from:'2026-10-20',to:'2026-10-26'};
const scope=(await query("SELECT p.organization_id AS organizationId,p.id AS projectId,p.slug AS projectSlug,i.id AS integrationId,i.provider,i.external_account_id AS accountId,json_extract(i.config_json,'$.accountTimezone') AS timezone,json_extract(i.config_json,'$.expectedCurrency') AS currency FROM integrations i JOIN projects p ON p.id=i.project_id WHERE i.id='int_visa_meta' AND p.id=?",[project.id])).results[0];
assert.ok(scope);const provider=await readAdsSnapshot(db,scope,range.from,range.to),crm=await summary({TOYS_DB:db},project,range.from,range.to);
assert.equal(crm.coverage.sourceFilter.utm_source,'toys');assert.equal(crm.campaignAttributionAvailable,true);
const tree=campaignIndex(project.id,[provider],range),coverage=attachCampaignQualifications(tree,crm,range),page=campaignPage({tree,range,limit:2000}),dataset=campaignDataset(tree,[],range);
assert.equal(page.rows.reduce((sum,row)=>sum+(row.metrics.qualifiedLeads||0),0),coverage.matched);assert.equal(coverage.matched+coverage.unmatched,crm.qualified);
assert.deepEqual(datasetPage(dataset,{sort:'cpql'}),campaignPage({tree,range,sort:'cpql'}));
for(const row of page.rows){const q=row.metrics.qualifiedLeads;assert.equal(row.metrics.cpql,q>0?row.metrics.spend/q:null);}
const reasons=(await query("SELECT COALESCE(c.attribution_state,'unverified') AS reason,COUNT(*) AS qualified FROM keycrm_cards c JOIN keycrm_sync s ON s.project_id=c.project_id AND s.active_scan_id=c.scan_id WHERE c.project_id=? AND c.utm_source='toys' AND c.first_qualified_observed_at IS NOT NULL AND c.received_date BETWEEN ? AND ? GROUP BY c.attribution_state",[project.id,range.from,range.to])).results;
console.log(JSON.stringify({project:project.slug,range,coverage,reasons,campaigns:page.rows.filter(r=>r.metrics.qualifiedLeads>0).map(r=>({name:r.name,qualified:r.metrics.qualifiedLeads,cost:r.metrics.cpql,currency:r.currency})),validation:'SELECT-only CRM cohort, campaign cost and browser dataset passed'}));
