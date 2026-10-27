// SELECT-only verification of the dashboard calculation against the working D1.
// Uses the deployed source's summary code; does not create a login or bypass auth.
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {summary} from '../crm/service.js';
import {visaKeyCRM} from '../crm/keycrm.js';
const query=(sql,params=[])=>new Promise((resolve,reject)=>{
 const p=spawn('python',['recovery-tests/read-only-d1.py']);let output='',error='';
 p.stdout.on('data',s=>output+=s);p.stderr.on('data',s=>error+=s);
 p.on('error',reject);p.on('close',code=>{if(code)reject(new Error(error));else{try{resolve(JSON.parse(output));}catch(e){reject(e);}}});
 p.stdin.end(JSON.stringify({sql,params}));
});
class Statement{
 constructor(sql){this.sql=sql;this.params=[];}
 bind(...params){this.params=params;return this;}
 async first(){return (await query(this.sql,this.params)).results[0]||null;}
 async all(){return query(this.sql,this.params);}
 run(){throw new Error('Remote writes disabled');}
}
const env={TOYS_DB:{prepare:sql=>new Statement(sql)}},project={id:visaKeyCRM.projectId,slug:visaKeyCRM.projectSlug};
const ledger=(await query('SELECT c.received_at,c.received_date,c.first_qualified_observed_at,c.utm_source FROM keycrm_cards c JOIN keycrm_sync s ON s.project_id=c.project_id AND s.active_scan_id=c.scan_id WHERE c.project_id=?',[project.id])).results;
assert.ok(ledger.length,'No published KeyCRM snapshot');
const calendar=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'});
for(const row of ledger)assert.equal(row.received_date,calendar.format(new Date(row.received_at)));
const periods=[];
for(const [from,to] of [['2026-10-20','2026-10-26'],['2026-10-01','2026-10-27']]){
 const data=await summary(env,project,from,to);
 assert.equal(data.source,'keycrm');assert.equal(data.available,true);assert.equal(data.sales,null);assert.deepEqual(data.byAd,[]);
 assert.equal(data.qualified,ledger.filter(r=>r.utm_source==='toys'&&r.first_qualified_observed_at&&r.received_date>=from&&r.received_date<=to).length);
 assert.deepEqual(data.coverage.sourceFilter,{utm_source:'toys'});
 assert.equal(data.unmatchedQualifiedLeads,data.qualified);assert.equal(data.coverage.historicalStatusCoverage,'observed_only');
 periods.push({from,to,qualified:data.qualified,lastSyncedAt:data.lastSyncedAt,freshness:data.freshness});
}
console.log(JSON.stringify({project:project.slug,publishedCards:ledger.length,toysQualified:ledger.filter(r=>r.utm_source==='toys'&&r.first_qualified_observed_at).length,sourceFilter:{utm_source:'toys'},timeZone:'Europe/Warsaw',periods,validation:'SELECT-only published snapshot and dashboard summary passed'}));
