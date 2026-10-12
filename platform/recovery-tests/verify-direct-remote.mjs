// Opt-in SELECT-only check: real D1 records through Cloudflare API, local Worker.
// This does not claim to visit the public report URL from a real client browser.
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {testWorker} from './fixture.mjs';
const worker=await testWorker();
const query=(sql,params)=>new Promise((resolve,reject)=>{
 const p=spawn('python',['recovery-tests/read-only-d1.py']);let out='',err='';
 p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);
 p.on('close',code=>{if(code)reject(new Error(err));else{try{resolve(JSON.parse(out));}catch(e){reject(e);}}});p.stdin.end(JSON.stringify({sql,params}));
});
class Statement{constructor(sql){this.sql=sql;this.params=[];}bind(...params){this.params=params;return this;}async first(){return(await query(this.sql,this.params)).results[0]||null;}async all(){return query(this.sql,this.params);}run(){throw new Error('Remote writes disabled');}}
const projects='housevip-cxp7,karlovarska-sul-k4rm,profkit-instashop-r4vk';
const env={ENVIRONMENT:'staging',DIRECT_ADS_READ_ENABLED:'true',MVP_PUBLIC_VIEW_PROJECTS:projects,TOYS_DB:{prepare:sql=>new Statement(sql)}};
globalThis.fetch=()=>{throw new Error('Dashboard attempted an external provider request');};
for(const slug of projects.split(',')){
 const r=await worker.fetch(new Request(`https://verification.local/api/v2/projects/${slug}/ads-summary?from=2026-10-06&to=2026-10-12`),env);
 const data=await r.json();assert.ok(r.ok,slug+JSON.stringify(data));
 assert.equal(data.providers.length,slug==='karlovarska-sul-k4rm'?2:1);
 for(const p of data.providers){assert.ok(p.hierarchy);assert.equal(p.coverage,'complete');assert.equal(p.coveredDates.length,7);assert.ok(p.fetchedAt);}
 if(slug==='profkit-instashop-r4vk')assert.ok(data.exchangeRates.some(r=>r.date==='2026-10-12'&&r.rate>0),'Today USD/UAH rate missing');
 console.log(JSON.stringify({project:slug,providers:data.providers.map(p=>({provider:p.provider,coverage:p.coverage,freshness:p.freshness,fetchedAt:p.fetchedAt})),status:'D1 read passed; no provider fetch'}));
}
