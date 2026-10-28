import test from 'node:test';
import assert from 'node:assert/strict';
import {qualificationCost} from '../native/qualification-cost.js';
import {advertisingModel} from '../unified/model.js';
const crm={available:true,qualified:5},rows=[{currency:'PLN',spend:2454.8},{currency:'PLN',spend:1399.99}];
test('project qualification cost uses spend and CRM qualifications, independent of ad results',()=>{
 assert.deepEqual(qualificationCost(rows,crm),{value:770.958,currency:'PLN'});
 assert.deepEqual(qualificationCost([{currency:'PLN',spend:0}],crm),{value:0,currency:'PLN'});
});
test('unknown spend, missing CRM, zero qualifications and mixed currencies never become a price',()=>{
 for(const data of [[],[...rows,{currency:'PLN',spend:null}],[...rows,{currency:'USD',spend:10}],[{currency:'',spend:1}],[{currency:'PLN',spend:NaN}]])assert.equal(qualificationCost(data,crm),null);
 for(const stats of [null,{available:false,qualified:5},{available:true,qualified:0},{available:true,qualified:null}])assert.equal(qualificationCost(rows,stats),null);
});
test('cost follows the selected period and replaces snapshot spend once with imported spend',()=>{
 const metric=value=>({value:String(value),state:'observed'}),range={from:'2026-10-20',to:'2026-10-26'};
 const dashboard={advertising:{channels:{meta:{rows:[{date:'2026-10-20',metrics:[{metricCode:'ads.spend',currency:'PLN',...metric(100)}]},{date:'2026-10-19',metrics:[{metricCode:'ads.spend',currency:'PLN',...metric(9999)}]}]}}}};
 const ads={providers:[{provider:'meta_ads',requestedRange:range,hierarchy:{currency:'PLN',children:[{providerId:'one',dailyMetrics:[{date:'2026-10-20',metrics:{spend:metric(250)}}]}]}}]};
 assert.deepEqual(qualificationCost(advertisingModel(dashboard,ads,range),crm),{value:50,currency:'PLN'});
});
