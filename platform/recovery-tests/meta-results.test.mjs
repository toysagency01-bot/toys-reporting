import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveMetaResults,resultActionValue,rowResultValue,rowResultKeys} from '../imports/meta-results.js';
import {reconcileMetaAccount} from '../imports/meta-reconciliation.js';
const row=(adset,actions)=>({account_id:'123',account_currency:'PLN',adset_id:adset,date_start:'2026-10-20',date_stop:'2026-10-20',impressions:'100',clicks:'5',spend:'10',actions});
const actions=(...values)=>values.map(([action_type,value])=>({action_type,value}));
const rows=[row('1',actions(['lead','7'],['offsite_conversion.custom.9','13'],['offsite_conversion.fb_pixel_custom.invitee_meeting_scheduled','13'])),row('2',actions(['lead','11'],['offsite_conversion.fb_pixel_lead','11'])),row('3',actions(['lead','0'],['offsite_conversion.custom.10','3']))];
const objects={
 '1':{id:'1',account_id:'123',promoted_object:{custom_conversion_id:'9'},optimization_goal:'OFFSITE_CONVERSIONS'},
 '2':{id:'2',account_id:'123',promoted_object:{custom_event_type:'LEAD'},optimization_goal:'OFFSITE_CONVERSIONS'},
 '3':{id:'3',account_id:'123',promoted_object:{custom_conversion_id:'10'},optimization_goal:'OFFSITE_CONVERSIONS'},
 '9':{id:'9',account_id:'act_456',name:'invitee_meeting_scheduled'},'10':{id:'10',name:'Website Lead'}
};
const scope={accountId:'123',currency:'PLN',timezone:'Europe/Warsaw',from:'2026-10-20',to:'2026-10-20',apiVersion:'v26.0'};
const mapping=()=>resolveMetaResults({rows,accountId:'123',fallbackKeys:['lead'],readObjects:async ids=>Object.fromEntries(ids.map(id=>[id,objects[id]]))});
const accountRows=items=>[{...items[0],impressions:String(items.reduce((s,r)=>s+Number(r.impressions),0)),clicks:String(items.reduce((s,r)=>s+Number(r.clicks),0)),spend:String(items.reduce((s,r)=>s+Number(r.spend),0)),actions:actions(['lead',String(items.reduce((s,r)=>s+Number(resultActionValue(r.actions,['lead'])),0))])}];
test('Meta Results follows each ad set custom conversion and counts aliases only once',async()=>{
 const m=await mapping();
 assert.deepEqual(rows.map(r=>resultActionValue(r.actions,rowResultKeys(r,['lead'],m))),['13','11','3']);
 assert.equal(m.adsets['1'].name,'invitee_meeting_scheduled');assert.deepEqual(m.adsets['1'].actionTypes,['offsite_conversion.custom.9']);
 assert.equal(resultActionValue(rows[0].actions,['lead']),'7');
 assert.throws(()=>rowResultKeys(row('999',[]),['lead'],m),{code:'meta_result_adset_unmapped'});
});
test('named custom pixel events use conversions without adding duplicate actions or generic custom buckets',async()=>{
 const customRow={...row('4',actions(['lead','0'],['offsite_conversion.fb_pixel_custom','99'],['offsite_conversion.fb_pixel_custom.invitee_meeting_scheduled','13'])),conversions:actions(['offsite_conversion.fb_pixel_custom.invitee_meeting_scheduled','13'])};
 const m=await resolveMetaResults({rows:[customRow],accountId:'123',fallbackKeys:['lead'],readObjects:async()=>({'4':{id:'4',account_id:'123',promoted_object:{custom_event_type:'OTHER',custom_event_str:'invitee_meeting_scheduled'}}})});
 assert.equal(rowResultValue(customRow,rowResultKeys(customRow,['lead'],m)),'13');assert.deepEqual(m.adsets['4'].observedConversionTypes,['offsite_conversion.fb_pixel_custom.invitee_meeting_scheduled']);
 const result=await reconcileMetaAccount({scope,adRows:[customRow],eventKeys:['lead'],resultMapping:m,fetchPage:async params=>{if(params.level==='adset')assert.match(params.fields,/conversions/);return {data:[customRow]};}});assert.equal(result.status,'matched');assert.equal(result.adTotals.conversions,'13');
});
test('independent ad-set report reconciles selected results rather than applying lead globally',async()=>{
 const m=await mapping(),calls=[];
 const result=await reconcileMetaAccount({scope,adRows:rows,eventKeys:['lead'],resultMapping:m,fetchPage:async params=>{calls.push(params);return {data:params.level==='account'?accountRows(rows):rows};}});
 assert.equal(result.status,'matched');assert.equal(result.accountTotals.conversions,'27');assert.equal(result.adTotals.conversions,'27');assert.equal(result.adTotals.leads,'18');
 assert.equal(result.comparisonLevel,'adset');assert.equal(calls[0].level,'adset');assert.match(calls[0].fields,/adset_id/);
 const bad=await reconcileMetaAccount({scope,adRows:rows,eventKeys:['lead'],resultMapping:m,fetchPage:async p=>({data:p.level==='account'?accountRows(rows):rows.map(r=>r.adset_id==='1'?{...r,actions:actions(['offsite_conversion.custom.9','14'],['lead','7'])}:r)})});
 assert.equal(bad.status,'mismatch');assert.equal(bad.daily[0].differences.conversions,'-1');
});
test('financial totals stay independently checked at account level when ad-set aggregation differs',async()=>{
 const m=await mapping();
 const result=await reconcileMetaAccount({scope,adRows:rows,eventKeys:['lead'],resultMapping:m,fetchPage:async p=>({data:p.level==='account'?accountRows(rows):rows.map((r,i)=>i===0?{...r,spend:'10.02',impressions:'101'}:r)})});
 assert.equal(result.status,'matched');assert.equal(result.financialComparisonLevel,'account');assert.equal(result.accountTotals.spend,'30');assert.equal(result.accountTotals.conversions,'27');
 const bad=await reconcileMetaAccount({scope,adRows:rows,eventKeys:['lead'],resultMapping:m,fetchPage:async p=>({data:p.level==='account'?accountRows(rows).map(r=>({...r,spend:'30.02'})):rows})});
 assert.equal(bad.status,'mismatch');assert.equal(bad.daily[0].differences.spend,'-0.02');
});
test('Meta result metadata fails closed on absent objects, wrong accounts or unresolved custom events',async()=>{
 for(const replacement of [undefined,{...objects['1'],account_id:'456'},{...objects['1'],promoted_object:{custom_event_type:'OTHER'}}]){
  await assert.rejects(resolveMetaResults({rows:[rows[0]],accountId:'123',fallbackKeys:['lead'],readObjects:async ids=>Object.fromEntries(ids.map(key=>[key,key==='1'?replacement:objects[key]]))}));
 }
});
test('an unmapped or duplicate independent ad set cannot validate a partial result snapshot',async()=>{
 const m=await mapping();
 for(const actual of [[...rows,rows[0]],[...rows,row('99',[])]])await assert.rejects(reconcileMetaAccount({scope,adRows:rows,eventKeys:['lead'],resultMapping:m,fetchPage:async()=>({data:actual})}));
});
