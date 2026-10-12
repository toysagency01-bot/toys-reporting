import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
const worker=await testWorker(),base='/api/v2/projects/housevip-cxp7';
const range='?from=2026-10-06&to=2026-10-12';
const fast=promise=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Response waited for the blocked provider')),500);})]).finally(()=>clearTimeout(timer));};

test('concurrent summary and creative requests return promptly, share a durable refresh and pick up its completed data',async()=>{
 const{env,db}=fixture(),originalFetch=globalThis.fetch,pending=[];
 let release,started;const gate=new Promise(r=>release=r),providerStarted=new Promise(r=>started=r);let insights=0;
 try{
  env.ENVIRONMENT='staging';env.META_ADS_ACCESS_TOKEN='synthetic';env.META_APP_SECRET='synthetic';
  db.exec(`INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES('synthetic-meta','prj_housevip_cxp7','meta_ads','123','active','{"timezone":"Asia/Tbilisi","currency":"IDR"}')`);
  globalThis.fetch=async(input,options)=>{assert.ok(options.signal);if(new URL(input).pathname.endsWith('/insights')){insights++;started();await gate;return Response.json({data:[{account_id:'123',account_currency:'IDR',campaign_id:'1',adset_id:'2',ad_id:'3',ad_name:'Updated creative',date_start:'2026-10-07',date_stop:'2026-10-07',impressions:'100',clicks:'10',spend:'20',actions:[{action_type:'lead',value:'2'}]}]});}return Response.json({id:'3',creative:{id:'33',thumbnail_url:'https://scontent.xx.fbcdn.net/preview.jpg'}});};
  const ctx={waitUntil:p=>pending.push(p)};
  const first=await fast(worker.fetch(request(base+'/ads-summary'+range,{role:null}),env,ctx));assert.equal(first.status,200);assert.equal((await first.json()).refreshing,true);
  await providerStarted;
  const creative=await fast(worker.fetch(request(base+'/top-creatives'+range,{role:null}),env,ctx));assert.equal((await creative.json()).refreshing,true);assert.equal(insights,1);
  release();await Promise.all(pending);
  const complete=await fast(worker.fetch(request(base+'/ads-summary'+range,{role:null}),env,ctx));const data=await complete.json();assert.equal(data.refreshing,false);assert.equal(data.providers[0].hierarchy.dailyMetrics,undefined);assert.equal(data.providers[0].hierarchy.children[0].dailyMetrics[0].metrics.clicks.value,'10');
  const ranked=await(await worker.fetch(request(base+'/top-creatives'+range,{role:null}),env,ctx)).json();assert.equal(ranked.refreshing,false);assert.equal(ranked.rankings.leads[0].rows[0].name,'Updated creative');assert.equal(ranked.rankings.leads[0].rows[0].previewStatus,'ready');assert.equal(insights,1);
  assert.equal((await worker.fetch(request(base+'/content-project/ads/hierarchy'+range,{role:null}),env,ctx)).status,403);
 }finally{release();await Promise.allSettled(pending);globalThis.fetch=originalFetch;db.close();}
});

test('expired cached statistics remain readable while a separate request refreshes them',async()=>{
 const{env,db}=fixture(),originalFetch=globalThis.fetch,pending=[];let release,started;
 try{
  env.META_ADS_ACCESS_TOKEN='synthetic';env.META_APP_SECRET='synthetic';
  db.exec(`INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES('synthetic-meta','prj_housevip_cxp7','meta_ads','123','active','{"timezone":"Asia/Tbilisi","currency":"IDR"}')`);
  let clicks='10',gate=Promise.resolve();
  globalThis.fetch=async input=>{if(new URL(input).pathname.endsWith('/insights')){started?.();await gate;return Response.json({data:[{account_id:'123',account_currency:'IDR',campaign_id:'1',adset_id:'2',ad_id:'3',date_start:'2026-10-07',date_stop:'2026-10-07',impressions:'100',clicks,spend:'20'}]});}return Response.json({id:'3',creative:{id:'33'}});};
  await worker.fetch(request(base+'/content-project/ads/hierarchy'+range),env);
  db.exec("UPDATE ads_on_demand_cache SET last_good_at='2000-01-01T00:00:00Z',expires_at='2000-01-01T00:20:00Z'; UPDATE ads_on_demand_refresh_guards SET last_started_at='2000-01-01T00:00:00Z'");
  clicks='25';gate=new Promise(r=>release=r);const providerStarted=new Promise(r=>started=r),ctx={waitUntil:p=>pending.push(p)};
  const stale=await fast(worker.fetch(request(base+'/content-project/ads/hierarchy'+range),env,ctx));const data=await stale.json();assert.equal(data.refreshing,true);assert.equal(data.providers[0].hierarchy.dailyMetrics[0].metrics.clicks.value,'10');
  await providerStarted;release();await Promise.all(pending);
  const fresh=await(await worker.fetch(request(base+'/content-project/ads/hierarchy'+range),env,ctx)).json();assert.equal(fresh.refreshing,false);assert.equal(fresh.providers[0].hierarchy.dailyMetrics[0].metrics.clicks.value,'25');
 }finally{release?.();await Promise.allSettled(pending);globalThis.fetch=originalFetch;db.close();}
});
