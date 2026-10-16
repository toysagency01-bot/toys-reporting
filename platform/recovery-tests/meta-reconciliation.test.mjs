import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileMetaAccount} from '../imports/meta-reconciliation.js';
const scope={accountId:'123',currency:'CZK',timezone:'Europe/Prague',from:'2026-10-01',to:'2026-10-03',apiVersion:'v26.0'};
const row=(date,spend,leads='1')=>({account_id:'123',account_currency:'CZK',date_start:date,date_stop:date,impressions:'100',clicks:'3',spend,actions:[{action_type:'lead',value:leads},{action_type:'onsite_conversion.lead_grouped',value:leads}]});
test('independent account report matches exact decimals, named leads and empty days without summing overlapping actions',async()=>{
 const requested=[];const ads=[row('2026-10-01','0.1'),row('2026-10-01','0.2'),row('2026-10-02','1.25','0')];
 const first={...row('2026-10-01','0.3','2'),impressions:'200',clicks:'6'};
 const report=await reconcileMetaAccount({scope,adRows:ads,eventKeys:['lead'],fetchPage:async p=>{requested.push(p);return p.after?{data:[row('2026-10-02','1.25','0')]}:{data:[first],paging:{next:'https://graph.facebook.com/v26.0/act_123/insights?after=next'}};}});
 assert.equal(report.status,'matched');assert.equal(report.comparedDays,3);assert.equal(report.matchedDays,3);
 assert.equal(report.accountTotals.spend,'1.55');assert.equal(report.adTotals.conversions,'2');
 assert.equal(requested[0].level,'account');assert.equal(requested[1].after,'next');
 assert.equal(report.attribution.adsManagerSelectionVerified,false);
});
test('a missing ad and a one-cent difference remain visible; offsets across days cannot hide a mismatch',async()=>{
 const report=await reconcileMetaAccount({scope,adRows:[row('2026-10-01','1.01'),row('2026-10-02','0.99')],eventKeys:['lead'],fetchPage:async()=>({data:[row('2026-10-01','1'),row('2026-10-02','1'),row('2026-10-03','2','3')]})});
 assert.equal(report.status,'mismatch');assert.equal(report.matchedDays,0);
 assert.equal(report.daily[0].differences.spend,'0.01');assert.equal(report.daily[1].differences.spend,'-0.01');
 assert.equal(report.daily[2].differences.conversions,'-3');
});
test('audit checks purchase value and funnel events independently without double-counting action aliases',async()=>{
 const ad={...row('2026-10-01','10'),actions:[{action_type:'lead',value:'1'},{action_type:'omni_purchase',value:'2'},{action_type:'purchase',value:'2'},{action_type:'omni_add_to_cart',value:'3'},{action_type:'omni_initiated_checkout',value:'2'}],action_values:[{action_type:'omni_purchase',value:'100.01'},{action_type:'purchase',value:'100.01'}]};
 const account={...ad,action_values:[{action_type:'omni_purchase',value:'100.02'}]};
 const result=await reconcileMetaAccount({scope,adRows:[ad],eventKeys:['lead'],fetchPage:async p=>{assert.ok(p.fields.includes('action_values'));return {data:[account]};}});
 assert.equal(result.status,'mismatch');assert.equal(result.adTotals.purchases,'2');assert.equal(result.adTotals.purchaseValue,'100.01');
 assert.equal(result.adTotals.leads,'1');assert.equal(result.adTotals.addToCart,'3');assert.equal(result.adTotals.checkout,'2');
 assert.equal(result.daily[0].differences.purchaseValue,'-0.01');
});
test('audit refuses wrong accounts, duplicate days, missing metrics and pagination outside the account',async()=>{
 const base={scope,adRows:[row('2026-10-01','1')],eventKeys:['lead']};
 for(const data of [[{...row('2026-10-01','1'),account_id:'456'}],[row('2026-10-01','1'),row('2026-10-01','1')],[{...row('2026-10-01','1'),clicks:undefined}]])await assert.rejects(reconcileMetaAccount({...base,fetchPage:async()=>({data})}));
 await assert.rejects(reconcileMetaAccount({...base,fetchPage:async()=>({data:[],paging:{next:'https://graph.facebook.com/v26.0/act_456/insights?after=next'}})}),{code:'account_audit_pagination_scope'});
});
