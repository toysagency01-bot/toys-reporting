import test from 'node:test';import assert from 'node:assert/strict';import {liveCommerce} from '../native/live-commerce.js';
const r={from:'2026-10-12',to:'2026-10-12'},m=n=>({value:String(n),state:'observed'});
test('live commerce pairs same-day Meta business outcomes with live spend, without summing hierarchy levels',()=>{
 const p={provider:'meta_ads',requestedRange:r,hierarchy:{currency:'CZK',children:[{providerId:'c',name:'Campaign',dailyMetrics:[{date:r.from}],children:[{children:[{outcomeDaily:[{date:r.from,metrics:{purchases:m(2),purchaseValue:m(100),addToCart:m(4),checkout:m(3)}}]}]}]}]}};
 const d=liveCommerce([p],r);assert.equal(d.account[0].metrics.find(m=>m.metricCode==='ecom.purchase_value').value,'100');assert.equal(d.campaigns.length,1);assert.deepEqual(d.completeProviders,['meta_ads']);assert.deepEqual(liveCommerce([p],{from:'2026-10-11',to:'2026-10-11'}).account,[]);
 p.hierarchy.children[0].children[0].children[0].outcomeDaily=[];assert.deepEqual(liveCommerce([p],r).completeProviders,[]);
});
