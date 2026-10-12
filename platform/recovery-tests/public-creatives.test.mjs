import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
const worker=await testWorker();
test('public board ranking loads Meta outcomes through project scope without leaking private hierarchy',async()=>{
 const{env,db}=fixture();const originalFetch=globalThis.fetch;
 try{
  env.ENVIRONMENT='staging';env.META_ADS_ACCESS_TOKEN='synthetic';env.META_APP_SECRET='synthetic';
  db.exec(`INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES('synthetic-meta','prj_housevip_cxp7','meta_ads','123','active','{"timezone":"Asia/Tbilisi","currency":"IDR"}')`);
  globalThis.fetch=async input=>new URL(input).pathname.endsWith('/insights')?Response.json({data:[{account_id:'123',account_currency:'IDR',campaign_id:'1',campaign_name:'Campaign',adset_id:'2',adset_name:'Group',ad_id:'3',ad_name:'Published creative',date_start:'2026-10-07',date_stop:'2026-10-07',impressions:'100',clicks:'10',spend:'20',actions:[{action_type:'omni_purchase',value:'2'}],action_values:[{action_type:'omni_purchase',value:'100'}]}]}):Response.json({id:'3',creative:{id:'33',thumbnail_url:'https://scontent.xx.fbcdn.net/preview.jpg'}});
  const r=await worker.fetch(request('/api/v2/projects/housevip-cxp7/top-creatives?from=2026-03-01&to=2026-10-07',{role:null}),env);assert.equal(r.status,200);const data=await r.json();assert.equal(data.rankings.roas.find(g=>g.provider==='meta_ads').rows[0].score,5);assert.equal(data.rankings.roas.find(g=>g.provider==='meta_ads').rows[0].previewUrl,'https://scontent.xx.fbcdn.net/preview.jpg');
  const summary=await(await worker.fetch(request('/api/v2/projects/housevip-cxp7/ads-summary?from=2026-03-01&to=2026-10-07',{role:null}),env)).json();assert.deepEqual(summary.providers[0].hierarchy.children[0].children,[]);assert.equal(summary.commerce.account[0].metrics.find(m=>m.metricCode==='ecom.purchases').value,'2');
  assert.ok(!JSON.stringify(data).includes('synthetic-meta'));assert.ok(!JSON.stringify(data).includes('providerId'));assert.ok(!JSON.stringify(data).includes('hierarchy'));
  const denied=await worker.fetch(request('/api/v2/projects/karlovarska-sul-k4rm/top-creatives?from=2026-10-01&to=2026-10-07',{role:null}),env);assert.equal(denied.status,403);
  const privateRoute=await worker.fetch(request('/api/v2/projects/housevip-cxp7/content-project/ads/hierarchy',{role:null}),env);assert.notEqual(privateRoute.status,200);
 }finally{globalThis.fetch=originalFetch;db.close();}
});
