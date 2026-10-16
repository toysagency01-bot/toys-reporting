// Opt-in, SELECT-only production readback. Never sends requests to ad providers.
// node recovery-tests/verify-rollout-remote.mjs PRIVATE_AUDIT_ROOT
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import assert from 'node:assert/strict';
import {testWorker,request} from './fixture.mjs';
import {advertisingModel,aggregate} from '../unified/model.js';
const root=resolve(process.argv[2]||'');assert.ok(process.argv[2]&&relative(resolve('..'),root).startsWith('..'));
process.umask(0o077);
const audits=JSON.parse(readFileSync(join(root,'audit-summary.json'))),slugs=[...new Set(audits.map(a=>a.slug))];
const query=(sql,params)=>new Promise((resolve,reject)=>{
 const p=spawn('python',['recovery-tests/read-only-d1.py']);let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('close',code=>{if(code)reject(Error(err));else try{resolve(JSON.parse(out));}catch(e){reject(e);}});p.stdin.end(JSON.stringify({sql,params}));
});
class Statement{constructor(sql){this.sql=sql;this.params=[];}bind(...p){this.params=p;return this;}async first(){return(await this.all()).results[0]||null;}all(){return query(this.sql,this.params);}run(){throw Error('Readback cannot write');}}
const env={ENVIRONMENT:'test',DIRECT_ADS_READ_ENABLED:'true',MVP_EDITOR_TOKEN:'synthetic-local-editor-token',MVP_EDITOR_PROJECTS:slugs.join(','),TOYS_DB:{prepare:sql=>new Statement(sql)}};
const worker=await testWorker();globalThis.fetch=()=>{throw Error('Dashboard attempted a provider request');};
const range={from:'2026-09-17',to:'2026-10-16'},results=[];
for(const slug of slugs){
 const base='/api/v2/projects/'+slug;
 const get=async path=>{const r=await worker.fetch(request(path),env,{waitUntil(){throw Error('Unexpected background refresh');}});assert.equal(r.status,200,path);return r.json();};
 const [snapshot,ads]=await Promise.all([get(base+'/dashboard?from='+range.from+'&toExclusive=2026-10-17'),get(base+'/ads-summary?from='+range.from+'&to='+range.to)]);
 const model=advertisingModel(snapshot.dashboard,ads,range),sources=[];
 assert.equal(ads.providers.length,audits.filter(a=>a.slug===slug).length);
 for(const p of ads.providers){
  const expected=audits.find(a=>a.slug===slug&&a.provider===p.provider);assert.equal(p.coverage,'complete');assert.equal(p.coveredDates.length,30);assert.equal(p.hierarchy.currency,expected.currency);
  const rows=model.filter(r=>r.provider===p.provider);assert.ok(rows.every(r=>r.source!=='snapshot'),'Covered days must replace published history');
  const actual=aggregate(rows);for(const k of ['impressions','clicks','conversions'])assert.ok(Math.abs((actual[k]||0)-Number(expected.totals[k]||0))<1e-8,slug+'/'+p.provider+'/'+k);
  assert.equal(actual.money.length,1);assert.equal(actual.money[0].currency,expected.currency);assert.ok(Math.abs(actual.money[0].spend-Number(expected.totals.spend))<1e-7,slug+'/spend');
  sources.push({provider:p.provider,coverage:p.coverage,fetchedAt:p.fetchedAt,currency:p.hierarchy.currency,totalsMatch:true});
 }
 const result={slug,sources,providerRequests:0};results.push(result);writeFileSync(join(root,'runtime-'+slug+'.json'),JSON.stringify({snapshot,ads}));console.log(JSON.stringify(result));
}
writeFileSync(join(root,'runtime-readback.json'),JSON.stringify(results,null,2));
