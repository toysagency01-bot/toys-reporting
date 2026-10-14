import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {campaignIndex,campaignPage,campaignMetrics,historicalCampaigns} from '../native/campaign-model.js';
import {fixture,testWorker,request} from './fixture.mjs';
import {saveAdsSnapshot} from '../imports/ads-store.js';
import {campaignAPI} from '../native/campaign-api.js';
const range={from:'2026-10-07',to:'2026-10-07'};
const observed=value=>({state:'observed',value:String(value)});
const daily=(date=range.from,spend=20)=>({date,metrics:{impressions:observed(100),clicks:observed(10),spend:observed(spend),conversions:observed(2),conversionValue:observed(0)}});
const ad=(id='3')=>({providerId:id,level:'ad',name:'Same name',dailyMetrics:[daily()],children:[],outcomeDaily:[{date:range.from,metrics:{purchases:observed(1),purchaseValue:observed(100)}}],previewUrl:'https://scontent.xx.fbcdn.net/image.jpg',secret:'must never leave the model'});
function provider(integrationId='account-one',currency='IDR'){
 const node=ad();return {provider:'meta_ads',integrationId,requestedRange:range,coveredDates:[range.from],coverage:'complete',freshness:'fresh',hierarchy:{providerId:'123',currency,timezone:'UTC',children:[{providerId:'1',name:'Same name',level:'campaign',dailyMetrics:[daily()],children:[{providerId:'2',name:'Group',level:'group',dailyMetrics:[daily()],children:[node]}]}]}};
}
test('campaigns, groups and ads are alternative levels; ratios use totals and outcomes are counted once',()=>{
 const p=provider(),tree=campaignIndex('project',[p],range);
 for(const e of tree.index.values()){const m=campaignMetrics(e.node,range);assert.equal(m.spend,20);assert.equal(m.purchases,1);assert.equal(m.roas,5);assert.equal(m.ctr,10);assert.equal(m.cpa,10);}
 const group=p.hierarchy.children[0].children[0];group.children=[];assert.equal(campaignMetrics(p.hierarchy.children[0],range).purchaseValue,null);
 const google=ad();google.outcomeDaily=[];google.dailyMetrics[0].metrics.conversions=observed(1.5);assert.equal(campaignMetrics(google,range).conversions,1.5);assert.equal(campaignMetrics(google,range).purchases,null);
});
test('same names and IDs in different accounts, currencies and projects never merge or authorize each other',()=>{
 const tree=campaignIndex('project',[provider(),provider('account-two','EUR')],range),page=campaignPage({tree,range});assert.equal(page.rows.length,2);assert.notEqual(page.rows[0].key,page.rows[1].key);
 assert.equal(campaignPage({tree:campaignIndex('other-project',[provider()],range),range,parent:page.rows[0].key}),null);
 assert.ok(!JSON.stringify(page).includes('account-one'));assert.ok(!JSON.stringify(page).includes('providerId'));assert.ok(!JSON.stringify(page).includes('must never leave'));
});
test('search follows descendants; pagination is stable and children are returned one level at a time',()=>{
 const p=provider();p.hierarchy.children[0].children[0].children=Array.from({length:105},(_,i)=>({...ad(String(i+3)),name:'Ad '+i}));
 const tree=campaignIndex('project',[p],range),root=campaignPage({tree,range,query:'Ad 101'});assert.equal(root.rows.length,1);assert.equal(root.rows[0].childCount,1);assert.equal(root.rows[0].children,undefined);
 const group=campaignPage({tree,range,parent:root.rows[0].key});assert.equal(group.rows.length,1);
 const a=campaignPage({tree,range,parent:group.rows[0].key}),b=campaignPage({tree,range,parent:group.rows[0].key,offset:a.nextOffset});
 assert.equal(a.rows.length,50);assert.equal(b.rows.length,50);assert.equal(new Set([...a.rows,...b.rows].map(r=>r.key)).size,100);assert.equal(a.total,105);
 assert.equal(campaignPage({tree,range,parent:a.rows[0].key}),null);
});
test('history uses only uncovered dates; partial multi-account data cannot double count published history',()=>{
 const snapshot={facts:{rows:['2026-10-06','2026-10-07'].map(date=>({date,campaign:{label:'History'},metrics:[{metricCode:'ads.spend',currency:'IDR',...observed(7)}]}))}},period={from:'2026-10-06',to:'2026-10-07'};
 const p=provider();p.requestedRange=period;
 assert.equal(historicalCampaigns('project',snapshot,[p],period)[0].metrics.spend,7);
 const missing={...provider('missing'),requestedRange:period,hierarchy:null};
 assert.equal(campaignIndex('project',[p,missing],period).roots.length,0);assert.equal(historicalCampaigns('project',snapshot,[p,missing],period)[0].metrics.spend,14);
 const other=provider('other');other.requestedRange=period;other.coveredDates=['2026-10-06'];
 assert.equal(campaignIndex('project',[p,other],period).roots.length,0);assert.equal(historicalCampaigns('project',snapshot,[p,other],period)[0].metrics.spend,14);
});
test('missing values stay unknown and missing conversion denominators never produce infinity',()=>{
 const a=ad();a.dailyMetrics[0].metrics.clicks={value:null,state:'missing'};a.dailyMetrics[0].metrics.conversions=observed(0);a.dailyMetrics[0].metrics.spend=observed(0);
 const m=campaignMetrics(a,range);assert.equal(m.clicks,null);assert.equal(m.ctr,null);assert.equal(m.cpa,null);assert.equal(m.roas,null);
});

const worker=await testWorker();
test('published campaign browser enforces project scope, serves saved levels and opens ads outside top three',async()=>{
 const {env,db}=fixture(),original=globalThis.fetch;
 try{
  db.exec(readFileSync('migrations/0017_direct_ads.sql','utf8'));env.DIRECT_ADS_READ_ENABLED='true';env.ENVIRONMENT='staging';
  env.META_ADS_ACCESS_TOKEN='synthetic';env.META_APP_SECRET='synthetic';
  db.exec(`INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES('account-one','prj_housevip_cxp7','meta_ads','123','active','{"timezone":"UTC","currency":"IDR"}')`);
  const p=provider();p.hierarchy.children[0].children[0].children.push({...ad('4'),name:'Not in top three'});
  await saveAdsSnapshot(env.TOYS_DB,{organizationId:'org_toys_agency',projectId:'prj_housevip_cxp7',integrationId:'account-one',provider:'meta_ads',accountId:'123',timezone:'UTC',currency:'IDR'}, {...p,fetchedAt:new Date().toISOString()});
  const base='/api/v2/projects/housevip-cxp7/campaign-browser',get=async suffix=>worker.fetch(request(base+suffix,{role:null}),env);
  const qs='?from=2026-10-07&to=2026-10-07';
  const root=await get(qs);assert.equal(root.status,200);const data=await root.json();assert.equal(data.rows.length,1);assert.equal(data.rows[0].metrics.spend,20);
  const groups=await(await get(qs+'&parent='+data.rows[0].key)).json();assert.equal(groups.rows[0].level,'group');
  const ads=await(await get(qs+'&parent='+groups.rows[0].key)).json();assert.equal(ads.rows.length,2);assert.equal(ads.rows[0].level,'ad');
  assert.ok(!JSON.stringify(ads).includes('account-one'));assert.ok(!JSON.stringify(ads).includes('providerId'));
  globalThis.fetch=async input=>new URL(input).pathname.endsWith('/44')?Response.json({id:'44',body:'Full ad copy',image_url:'https://scontent.xx.fbcdn.net/full.jpg'}):Response.json({id:'4',account_id:'123',creative:{id:'44'}});
  const selected=ads.rows.find(r=>r.name==='Not in top three');const creative=await get('/'+selected.key+'/creative'+qs);assert.equal(creative.status,200);assert.equal((await creative.json()).creative.bodies[0],'Full ad copy');
  assert.equal((await get('/'+'0'.repeat(64)+'/creative'+qs)).status,404);
  assert.equal((await get(qs+'&parent='+'0'.repeat(64))).status,404);
  assert.equal((await get('?from=2026-02-30&to=2026-03-01')).status,400);
  assert.equal((await get('?from=2026-10-07&to=2026-13-01')).status,400);
  assert.equal((await get(qs+'&offset=-1')).status,400);
  assert.equal((await worker.fetch(request(base.replace('housevip-cxp7','karlovarska-sul-k4rm')+qs,{role:null}),env)).status,403);
  assert.notEqual((await worker.fetch(request('/api/v2/projects/housevip-cxp7/content-project/ads/hierarchy'+qs,{role:null}),env)).status,200);
 }finally{globalThis.fetch=original;db.close();}
});

test('Google creative metadata uses only an accepted batch for the selected account and ad',async()=>{
 const {env,db}=fixture();try{
  const p=provider();p.provider='google_ads';p.hierarchy.providerId='1234567890';p.hierarchy.children[0].children[0].children[0].name=null;
  const project={id:'prj_housevip_cxp7',organizationId:'org_toys_agency',slug:'housevip-cxp7'};
  for(const [id,account,destination] of [['a','1234567890','https://example.test/correct'],['b','9999999999','https://example.test/wrong-account']]){
   db.prepare(`INSERT INTO google_ads_receiver_batches(snapshot_id,organization_id,project_id,customer_id,login_customer_id,api_version,range_from,range_to,currency_code,time_zone,page_size,total_rows,campaign_rows,ad_group_rows,ad_rows,next_expected_offset,received_rows,status,created_at,updated_at,accepted_at) VALUES(?,?,?,?,?,'v25',?,?,'IDR','UTC',100,1,0,0,1,1,1,'accepted',?,?,?)`).run(id.repeat(64),project.organizationId,project.id,account,'7753894623',range.from,range.to,range.from,range.to,range.to);
   db.prepare('INSERT INTO google_ads_receiver_row_pages VALUES(?,0,?)').run(id.repeat(64),JSON.stringify([{level:'ad',date:range.from,ad:{id:'3'},creative:{type:'RESPONSIVE_SEARCH_AD',finalUrls:[destination]}}]));
  }
  const tree=campaignIndex(project.id,[p],range),adEntry=[...tree.index.values()].find(e=>e.node.level==='ad');
  const dependencies={authorizeMvp:async()=>({ok:true}),projectRecord:async()=>project,onDemandAdsService:()=>({getStats:async()=>({providers:[p]})})};
  const res=await campaignAPI(request('/api/v2/projects/housevip-cxp7/campaign-browser/'+adEntry.key+'/creative?from='+range.from+'&to='+range.to),env,{},dependencies);
  assert.equal(res.status,200);const {creative}=await res.json();assert.equal(creative.destinationUrl,'https://example.test/correct');assert.equal(creative.contentStatus,'metadata_only');assert.deepEqual(creative.media,[]);assert.deepEqual(creative.bodies,[]);
 }finally{db.close();}
});
