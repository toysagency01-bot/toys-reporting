import test from 'node:test';import assert from 'node:assert/strict';
import {rankCreatives} from '../native/top-creatives.js';import {normalizeOutcomes,enrichMetaOutcomes} from '../native/outcomes.js';import {aggregateQualifiedLeads,attachCRMQualification} from '../native/crm-attribution.js';
const range={from:'2026-10-01',to:'2026-10-07'};const observed=value=>({value:String(value),state:'observed'});
const ad=(id,leads,purchases,value,spend=10)=>({level:'ad',providerId:id,name:id,dailyMetrics:[{date:range.from,metrics:{impressions:observed(100),clicks:observed(10),spend:observed(spend)}}],outcomeDaily:normalizeOutcomes([{date:range.from,metrics:{leads,purchases,purchaseValue:value}}],range.from,range.to)});
const provider=ads=>({provider:'meta_ads',integrationId:'account',requestedRange:range,hierarchy:{providerId:'123',currency:'EUR',children:[{children:[{children:ads}]}]}});
test('switches rank by explicit outcomes; unknown CRM qualifications never fall back to clicks',()=>{
 const p=provider([ad('lead winner',9,1,20),ad('sales winner',2,8,50),ad('roas winner',1,2,100),ad('fourth',0,0,0)]);
 assert.equal(rankCreatives([p],range,'leads')[0].rows[0].name,'lead winner');assert.equal(rankCreatives([p],range,'purchases')[0].rows[0].name,'sales winner');assert.equal(rankCreatives([p],range,'roas')[0].rows[0].name,'roas winner');assert.equal(rankCreatives([p],range,'leads')[0].rows.length,3);assert.deepEqual(rankCreatives([p],range,'qualifiedLeads')[0].rows,[]);
 assert.deepEqual(rankCreatives([p],{from:'2026-09-01',to:'2026-09-07'},'leads'),[]);
});
test('Meta events use one named purchase event, never sum overlapping attribution types',()=>{
 const a={id:'1'};enrichMetaOutcomes({campaigns:[{adsets:[{ads:[a]}]}]},[{ad_id:'1',date_start:range.from,actions:[{action_type:'omni_purchase',value:'2'},{action_type:'offsite_conversion.fb_pixel_purchase',value:'2'}],action_values:[{action_type:'omni_purchase',value:'100'}]}]);assert.equal(a.outcomeDaily[0].metrics.purchases,'2');assert.equal(a.outcomeDaily[0].metrics.leads,'0');assert.equal(a.outcomeDaily[0].metrics.qualifiedLeads,null);
});
const config={qualifiedStatuses:['Квалифицирован'],timeZone:'Asia/Tbilisi',completeFrom:'2026-01-01',throughDate:range.to};
const row=(leadId,changedAt,adId='1')=>({leadId,status:'Квалифицирован',changedAt,receivedAt:changedAt,metadataJson:JSON.stringify({adAttribution:{version:1,provider:'meta_ads',accountId:'123',adId}})});
test('CRM intake cohort counts each qualified lead once, rejects incomplete coverage and separates accounts',()=>{
 const rows=[row('same','2026-10-01T01:00:00Z'),row('same','2026-10-02T01:00:00Z'),row('old','2026-09-01T01:00:00Z'),row('old','2026-10-03T01:00:00Z'),row('unmapped','2026-10-03T01:00:00Z',''),{...row('other','2026-10-03T01:00:00Z'),metadataJson:JSON.stringify({adAttribution:{version:1,provider:'meta_ads',accountId:'456',adId:'1'}})}];
 const result=aggregateQualifiedLeads(rows,config,range);assert.equal(result.byAd.find(r=>r.accountId==='123').count,1);assert.equal(result.byAd.find(r=>r.accountId==='456').count,1);assert.equal(result.unmatched,1);assert.equal(aggregateQualifiedLeads(rows,{...config,throughDate:'2026-10-03'},range).status,'unavailable');
});
test('CRM aggregate is attached to the exact ad and period, without returning lead identifiers',async()=>{
 const p=provider([ad('1',3,1,20)]);const env={CRM_ATTRIBUTION_CONFIG:JSON.stringify({test:config}),TOYS_DB:{prepare:()=>({bind:()=>({all:async()=>({results:[row('private-lead-id','2026-10-02T01:00:00Z')]})})})}};
 const result=await attachCRMQualification({providers:[p]},env,{slug:'test',id:'test'},range);assert.equal(rankCreatives(result.providers,range,'qualifiedLeads')[0].rows[0].score,1);assert.ok(!JSON.stringify(result).includes('private-lead-id'));
});

test('Meta days without purchases contribute zero instead of discarding the creative',()=>{
 const a={id:'1'};enrichMetaOutcomes({campaigns:[{adsets:[{ads:[a]}]}]},[
 {ad_id:'1',date_start:range.from,actions:[{action_type:'omni_purchase',value:'2'}],action_values:[{action_type:'omni_purchase',value:'100'}]},
 {ad_id:'1',date_start:'2026-10-02',actions:[{action_type:'link_click',value:'5'}]}
 ]);
 const entry=ad('1',0,0,0);entry.outcomeDaily=normalizeOutcomes(a.outcomeDaily,range.from,range.to);
 assert.equal(rankCreatives([provider([entry])],range,'roas')[0].rows[0].score,10);
});
