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
const projects=process.argv[2]||'housevip-cxp7,karlovarska-sul-k4rm,profkit-instashop-r4vk';
const from=process.argv[3]||'2026-10-06',to=process.argv[4]||'2026-10-12';
assert.match(projects,/^[a-z0-9,-]+$/);assert.match(from,/^\d{4}-\d{2}-\d{2}$/);assert.match(to,/^\d{4}-\d{2}-\d{2}$/);
const env={ENVIRONMENT:'staging',DIRECT_ADS_READ_ENABLED:'true',MVP_PUBLIC_VIEW_PROJECTS:projects,TOYS_DB:{prepare:sql=>new Statement(sql)}};
globalThis.fetch=()=>{throw new Error('Dashboard attempted an external provider request');};
for(const slug of projects.split(',')){
 const r=await worker.fetch(new Request(`https://verification.local/api/v2/projects/${slug}/ads-summary?from=${from}&to=${to}`),env);
 const data=await r.json();assert.ok(r.ok,slug+JSON.stringify(data));
 assert.equal(data.providers.length,slug==='karlovarska-sul-k4rm'?2:1);
 for(const p of data.providers){assert.ok(p.hierarchy);assert.equal(p.coverage,'complete');assert.equal(p.coveredDates.length,(Date.parse(to)-Date.parse(from))/86400000+1);assert.ok(p.fetchedAt);}
 if(slug==='profkit-instashop-r4vk')assert.ok(data.exchangeRates.some(r=>r.date==='2026-10-12'&&r.rate>0),'Today USD/UAH rate missing');
 if(slug==='bs-clinic-a5b4'){
  const response=await worker.fetch(new Request(`https://verification.local/api/v2/projects/${slug}/top-creatives?from=${from}&to=${to}`),env);
  const creatives=await response.json();assert.equal(response.status,200);const rows=creatives.rankings.leads.find(p=>p.provider==='meta_ads')?.rows||[];assert.equal(rows.length,3);assert.ok(rows.every(r=>r.score>0));
  const denied=await worker.fetch(new Request(`https://verification.local/api/v2/projects/${slug}/content-crm?format=json`),env);assert.ok([401,403].includes(denied.status));
  console.log(JSON.stringify({project:slug,topCreatives:rows.length,previews:rows.filter(r=>r.previewUrl).length,crmProtected:true}));
 }
 console.log(JSON.stringify({project:slug,providers:data.providers.map(p=>({provider:p.provider,coverage:p.coverage,freshness:p.freshness,fetchedAt:p.fetchedAt})),status:'D1 read passed; no provider fetch'}));
}
