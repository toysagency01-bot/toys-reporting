import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {runKeyCRMSync,keyCRMSummary} from '../crm/keycrm-sync.js';
import {summary} from '../crm/service.js';
import {attachCRMQualification} from '../native/crm-attribution.js';
import {visaKeyCRM} from '../crm/keycrm.js';
import {keyCRMCoverage} from '../native/keycrm-coverage.js';
import {overviewMarkup} from '../master/overview.js';
import {keyCRMCampaignCatalogue} from '../crm/keycrm-campaigns.js';
const project={id:visaKeyCRM.projectId,slug:visaKeyCRM.projectSlug};
const t=Date.now(),mapping={pipelineId:'1',qualifiedStatusIds:['10','11','12']};
const card=(id,status='10')=>({cardId:String(id),pipelineId:'1',statusId:status,receivedAt:'2026-10-10T22:30:00.000Z',qualified:status!=='15',utmSource:'toys'});
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE projects(id TEXT PRIMARY KEY,slug TEXT,timezone TEXT,settings_json TEXT,status TEXT)');
 db.exec(readFileSync('migrations/0035_keycrm.sql','utf8'));
 db.exec(readFileSync('migrations/0036_keycrm_source.sql','utf8'));
 db.exec(readFileSync('migrations/0038_keycrm_campaigns.sql','utf8'));
 db.exec(readFileSync('migrations/0017_direct_ads.sql','utf8'));
 db.exec('CREATE TABLE integrations(id TEXT,project_id TEXT,provider TEXT,external_account_id TEXT)');
 db.prepare('INSERT INTO projects VALUES(?,?,?,?,?)').run(project.id,project.slug,'Europe/Warsaw',JSON.stringify({crmKeyCRM:{provider:'keycrm',secretName:visaKeyCRM.secretName,syncEnabled:true,qualifiedLabels:[...visaKeyCRM.qualifiedLabels]}}),'active');
 class Statement{constructor(sql){this.sql=sql;this.args=[];}bind(...a){this.args=a;return this;}async first(){return db.prepare(this.sql).get(...this.args)||null;}async all(){return {results:db.prepare(this.sql).all(...this.args)};}async run(){return {meta:{changes:Number(db.prepare(this.sql).run(...this.args).changes)}};}}
 const env={KEYCRM_VISA_API_TOKEN:'synthetic',TOYS_DB:{prepare:sql=>new Statement(sql),async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}}};
 return {db,env};
}
const factory=pages=>()=>({discover:async()=>mapping,cardsPage:async(m,p)=>{assert.deepEqual({...m,campaigns:undefined},{...mapping,campaigns:undefined});const v=pages[p-1];if(v instanceof Error)throw v;return v;}});
const range=['2026-10-11','2026-10-11'];
test('KeyCRM checkpoints pages, publishes complete scans and counts immutable intake once',async()=>{
 const {env,db}=fixture();const clientFactory=factory([{rows:[card(1)],total:2,done:false},{rows:[card(2,'15')],total:2,done:true}]);
 await runKeyCRMSync(env,t,{clientFactory,maxPages:1});
 assert.equal((await keyCRMSummary(env,project,...range)).available,false);
 assert.equal(db.prepare('SELECT next_page FROM keycrm_sync').get().next_page,2);
 await runKeyCRMSync(env,t+120001,{clientFactory,maxPages:1});
 let s=await summary(env,project,...range);assert.equal(s.qualified,1);assert.equal(s.sales,null);assert.deepEqual(s.byAd,[]);assert.equal(s.unmatchedQualifiedLeads,1);assert.equal(s.coverage.historicalStatusCoverage,'observed_only');
 assert.match(keyCRMCoverage(s),/История квалификаций неполная/);assert.match(keyCRMCoverage(s),/К кампаниям привязано: 0; без привязки: 1/);
 const view=overviewMarkup({projects:[{...project,name:'VISA',type:'leadgen'}],summaries:new Map([[project.slug,{crm:s,ads:[]}]]),slug:project.slug});assert.match(view.metrics,/KeyCRM/);assert.match(view.metrics,/class="value">—/);
 assert.equal((await summary(env,project,'2026-10-10','2026-10-10')).qualified,0);
 assert.equal((await summary(env,project,...range,'meta_ads')).qualified,null);
 await runKeyCRMSync(env,t+800000,{clientFactory:factory([{rows:[card(1,'11'),card(2,'10')],total:2,done:true}])});
 s=await summary(env,project,...range);assert.equal(s.qualified,2);
 await runKeyCRMSync(env,t+1600000,{clientFactory:factory([{rows:[card(2,'15')],total:1,done:true}])});
 assert.equal((await summary(env,project,...range)).qualified,2);
 assert.equal(db.prepare('SELECT present FROM keycrm_cards c JOIN keycrm_sync s ON c.scan_id=s.active_scan_id WHERE c.card_id=?').get('1').present,0);
 env.CRM_ATTRIBUTION_CONFIG=JSON.stringify({[project.slug]:{completeFrom:'2020-01-01'}});
 const body=await attachCRMQualification({providers:[{provider:'meta_ads',hierarchy:{children:[{children:[{children:[{providerId:'123',crmQualifiedLeads:{value:'0',state:'observed',from:range[0],to:range[1]}}]}]}]}}]},env,project,{from:range[0],to:range[1]});
 assert.equal(body.crmAttribution.status,'unavailable');assert.equal(body.providers[0].hierarchy.children[0].children[0].children[0].crmQualifiedLeads,undefined);
});
test('KeyCRM failures preserve published data, abandon partial scans, back off and block concurrent work',async()=>{
 const {env,db}=fixture();await runKeyCRMSync(env,t,{clientFactory:factory([{rows:[card(1)],total:1,done:true}])});
 const active=db.prepare('SELECT active_scan_id FROM keycrm_sync').get().active_scan_id;
 await runKeyCRMSync(env,t+700000,{clientFactory:factory([{rows:[card(2)],total:2,done:false},Object.assign(new Error('secret payload'),{code:'keycrm_rate_limited'})])});
 const state=db.prepare('SELECT * FROM keycrm_sync').get();assert.equal(state.active_scan_id,active);assert.equal(state.scan_id,null);assert.equal(state.last_error,'keycrm_rate_limited');assert.equal(state.attempts,1);
 assert.equal((await summary(env,project,...range)).qualified,1);
 let called=false;await runKeyCRMSync(env,t+700001,{clientFactory:()=>{called=true;}});assert.equal(called,false);
 db.prepare('UPDATE keycrm_sync SET next_attempt_at=?,lease_token=?,lease_until=?').run(new Date(t).toISOString(),'other',new Date(t+2000000).toISOString());
 await runKeyCRMSync(env,t+1000000,{clientFactory:()=>{called=true;}});assert.equal(called,false);
});
test('KeyCRM rejects changing page totals, duplicate IDs and changed intake before publication',async()=>{
 for(const mode of ['total','duplicate','intake']){
  const {env,db}=fixture();await runKeyCRMSync(env,t,{clientFactory:factory([{rows:[card(1)],total:1,done:true}])});
  const active=db.prepare('SELECT active_scan_id FROM keycrm_sync').get().active_scan_id;
  const pages=mode==='intake'?[{rows:[{...card(1),receivedAt:'2026-10-12T00:00:00.000Z'}],total:1,done:true}]:[{rows:[card(2)],total:2,done:false},{rows:[card(mode==='duplicate'?2:3)],total:mode==='total'?3:2,done:true}];
  await runKeyCRMSync(env,t+700000,{clientFactory:factory(pages)});
  assert.equal(db.prepare('SELECT state FROM keycrm_sync').get().state,'error');assert.equal(db.prepare('SELECT active_scan_id FROM keycrm_sync').get().active_scan_id,active);assert.equal((await summary(env,project,...range)).qualified,1);
 }
});
test('KeyCRM ignores disabled and unrelated projects',async()=>{
 const {env,db}=fixture();assert.equal(await keyCRMSummary(env,{id:'other'},...range),null);
 db.prepare('UPDATE projects SET settings_json=?').run('{}');let called=false;
 await runKeyCRMSync(env,t,{clientFactory:()=>{called=true;}});assert.equal(called,false);assert.equal(await keyCRMSummary(env,project,...range),null);
});
test('legacy unfiltered generations are hidden until a full source-verified rescan',async()=>{
 const {env,db}=fixture();
 await runKeyCRMSync(env,t,{clientFactory:factory([{rows:[card(1),card(2),card(3)],total:3,done:true}])});
 db.exec('UPDATE keycrm_sync SET source_filter=NULL; UPDATE keycrm_cards SET utm_source=NULL');
 const pending=await summary(env,project,...range);assert.equal(pending.available,false);assert.equal(pending.qualified,null);
 await runKeyCRMSync(env,t+700000,{clientFactory:factory([{rows:[card(1),{...card(2),utmSource:null}],total:2,done:true}])});
 const actual=await summary(env,project,...range);assert.equal(actual.qualified,1);assert.equal(actual.coverage.sourceFilter.utm_source,'toys');
 assert.match(keyCRMCoverage(actual),/Источник: toys/);
 const absent=db.prepare('SELECT c.utm_source,c.present FROM keycrm_cards c JOIN keycrm_sync s ON c.scan_id=s.active_scan_id WHERE c.card_id=?').get('3');assert.equal(absent.utm_source,null);assert.equal(absent.present,0);
});
test('verified own milestones survive absence, while an observed source change removes a qualification',async()=>{
 const {env}=fixture();
 await runKeyCRMSync(env,t,{clientFactory:factory([{rows:[card(1),card(2),{...card(3),utmSource:null}],total:3,done:true}])});
 assert.equal((await summary(env,project,...range)).qualified,2);
 await runKeyCRMSync(env,t+700000,{clientFactory:factory([{rows:[{...card(1),utmSource:null},card(3)],total:2,done:true}])});
 assert.equal((await summary(env,project,...range)).qualified,2); // absent 2 + newly marked 3
});
test('a partially scanned legacy generation restarts rather than mixing source verification',async()=>{
 const {env,db}=fixture();
 await runKeyCRMSync(env,t,{maxPages:1,clientFactory:factory([{rows:[card(1)],total:2,done:false}])});
 db.exec('UPDATE keycrm_sync SET scan_filter=NULL; UPDATE keycrm_cards SET utm_source=NULL');
 await runKeyCRMSync(env,t+120001,{clientFactory:factory([{rows:[card(1),{...card(2),utmSource:null}],total:2,done:true}])});
 assert.equal((await summary(env,project,...range)).qualified,1);
 assert.equal(db.prepare('SELECT source_filter FROM keycrm_sync').get().source_filter,'utm_source=toys');
});
test('campaign attribution publishes only a complete revision and retains verified absent cards',async()=>{
 const {env,db}=fixture();const matched={...card(1),attributionState:'matched',campaignProvider:'meta_ads',campaignAccountId:'123',campaignId:'456'};
 await runKeyCRMSync(env,t,{clientFactory:factory([{rows:[matched,card(2)],total:2,done:true}])});
 let s=await summary(env,project,...range);assert.equal(s.campaignAttributionAvailable,true);assert.equal(s.byCampaign[0].qualified,1);assert.equal(s.unmatchedCampaignQualifiedLeads,1);
 db.exec('UPDATE keycrm_sync SET attribution_revision=NULL');s=await summary(env,project,...range);assert.equal(s.qualified,2);assert.equal(s.campaignAttributionAvailable,false);assert.deepEqual(s.byCampaign,[]);
 await runKeyCRMSync(env,t+700000,{clientFactory:factory([{rows:[card(2)],total:1,done:true}])});
 s=await summary(env,project,...range);assert.equal(s.campaignAttributionAvailable,true);assert.equal(s.qualified,2);assert.equal(s.byCampaign[0].qualified,1);
 await runKeyCRMSync(env,t+1400000,{clientFactory:factory([{rows:[{...matched,utmSource:null},card(2)],total:2,done:true}])});
 s=await summary(env,project,...range);assert.equal(s.qualified,1);assert.deepEqual(s.byCampaign,[]);
});
test('KeyCRM campaign catalogue excludes other projects and account-mismatched snapshots',async()=>{
 const {env,db}=fixture();
 for(const [integration,owner,storedAccount] of [['own',project.id,'123'],['wrong-account',project.id,'999'],['other','other-project','123']]){
  db.prepare('INSERT INTO integrations VALUES(?,?,?,?)').run(integration,owner,'meta_ads','123');
  const payload={hierarchy:{providerId:storedAccount,children:[{providerId:'456',name:'TOYS / Consultation'}]}};
  db.prepare('INSERT INTO ads_daily_snapshots VALUES(?,?,?,?,?,?,?,?,?)').run(integration,'2026-10-10','org',owner,integration,'meta_ads',JSON.stringify(payload),'hash',new Date().toISOString());
 }
 const catalogue=await keyCRMCampaignCatalogue(env.TOYS_DB,project.id);assert.equal(catalogue.length,1);assert.equal(catalogue[0].accountId,'123');assert.equal(catalogue[0].campaignId,'456');
});
