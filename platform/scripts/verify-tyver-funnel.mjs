// Read-only production verification, limited to the requested project/account.
import {spawn} from 'node:child_process';
import {readAdsSnapshot} from '../imports/ads-store.js';
import {productRows,summarize} from '../product-funnel/model.js';
const query=(sql,params=[])=>new Promise((resolve,reject)=>{const p=spawn('python',['recovery-tests/read-only-d1.py']);let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('close',code=>{if(code)reject(new Error(err));else try{resolve(JSON.parse(out));}catch(e){reject(e);}});p.stdin.end(JSON.stringify({sql,params}));});
const db={prepare(sql){return {params:[],bind(...params){this.params=params;return this;},async first(){return (await query(sql,this.params)).results[0]||null;},all(){return query(sql,this.params);}};}};
const scopes=(await query("SELECT p.organization_id AS organizationId,p.id AS projectId,i.id AS integrationId,i.provider,i.external_account_id AS accountId,json_extract(i.config_json,'$.accountTimezone') AS timezone,json_extract(i.config_json,'$.expectedCurrency') AS currency FROM projects p JOIN integrations i ON i.project_id=p.id WHERE p.id='prj_managed_tyver_20261029' AND i.provider='meta_ads' AND i.external_account_id='762053572501853' AND i.status='active'")).results;
if(scopes.length!==1)throw Error('TYVER account identity mismatch');const scope=scopes[0];
const provider=await readAdsSnapshot(db,scope,'2026-10-22','2026-10-28');
if(!provider){console.log(JSON.stringify({ready:false,reason:'no_snapshot_yet'}));process.exit(0);}
const rows=productRows(provider),s=summarize(rows),types=new Set();for(const c of provider.hierarchy.children||[])for(const g of c.children||[])for(const a of g.children||[])for(const t of a.funnelEventTypes||[])types.add(t);
console.log(JSON.stringify({ready:provider.coverage==='complete',coverage:provider.coverage,freshness:provider.freshness,fetchedAt:provider.fetchedAt,currency:scope.currency,timezone:scope.timezone,rows:rows.length,campaigns:s.campaigns.map(c=>({id:c.campaignId,name:c.campaign})),dimensions:s.options,missingStages:['registrations','trials'].filter(k=>s.totals[k]===null),observedEventTypes:[...types].sort(),totals:s.totals},null,2));
