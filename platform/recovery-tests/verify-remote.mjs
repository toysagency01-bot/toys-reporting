// Opt-in SELECT-only check against staging data, through the authorized Cloudflare API.
// Does not authenticate a browser or validate the Pages routing layer.
import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
import {testWorker} from './fixture.mjs';import {advertisingModel,aggregate,businessMetrics} from '../unified/model.js';
import {sourceTable} from '../native/data.js';
const worker=await testWorker();
const query=(sql,params)=>new Promise((resolve,reject)=>{const p=spawn('python',['recovery-tests/read-only-d1.py']);let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('close',code=>{if(code)reject(new Error(err));else{try{resolve(JSON.parse(out));}catch(e){reject(e);}}});p.stdin.end(JSON.stringify({sql,params}));});
class Statement{constructor(sql){this.sql=sql;this.params=[];}bind(...params){this.params=params;return this;}async first(){return(await query(this.sql,this.params)).results[0]||null;}async all(){return query(this.sql,this.params);}run(){throw new Error('Remote writes disabled');}}
const env={ENVIRONMENT:'staging',MVP_PUBLIC_VIEW_PROJECTS:'housevip-cxp7,profkit-instashop-r4vk,karlovarska-sul-k4rm',MVP_PUBLIC_PROJECT_MATERIALS:'housevip-cxp7,profkit-instashop-r4vk,karlovarska-sul-k4rm',TOYS_DB:{prepare:sql=>new Statement(sql)}};
for(const slug of env.MVP_PUBLIC_VIEW_PROJECTS.split(',')){
 const r=await worker.fetch(new Request(`https://verification.local/api/v2/projects/${slug}/dashboard?from=2026-10-01&toExclusive=2026-10-10`),env);const d=await r.json();assert.ok(r.ok,slug+JSON.stringify(d));
 const range={from:'2026-10-01',to:'2026-10-09'};const rows=advertisingModel(d.dashboard,null,range);assert.ok(rows.length,slug+' has no advertising rows');const totals=aggregate(rows);assert.ok(totals.money.every(m=>m.currency&&m.spend!==null),slug+' spend mapping invalid');
 if(d.dashboard.ecommerce){for(const table of ['EcomFunnel','EcomFunnelCampaign']){const projected=sourceTable(d.dashboard,table);assert.ok(projected.table.rows.every(r=>['Meta Ads','Google Ads'].includes(r.c[1].v)),slug+' missing ecommerce platform');}}
 const materials=await(await worker.fetch(new Request(`https://verification.local/api/v2/projects/${slug}/content/tabs`),env)).json();assert.ok(materials.ok);
 console.log(JSON.stringify({slug,advertisingRows:rows.length,currencies:totals.money.map(m=>m.currency),businessMetrics:businessMetrics(d.dashboard,range).length,materialTabs:materials.tabs.length,status:'read-only data mapping passed'}));
}
