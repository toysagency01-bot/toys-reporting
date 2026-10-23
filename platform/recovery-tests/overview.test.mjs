import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewMarkup,spendGroups} from '../master/overview.js';
const p={slug:'amklinika-k8m2',name:'AM <Klinika>',type:'leadgen',canCRM:true,integrations:[{provider:'meta_ads',status:'active'}]};
test('overview aggregates currencies without mixing them and labels each advertising channel',()=>{
 const ads=[{provider:'meta_ads',currency:'CZK',spend:4361.99,conversions:18},{provider:'google_ads',currency:'CZK',spend:4891.6,conversions:4},{provider:'meta_ads',currency:'USD',spend:12,conversions:0}];
 const groups=spendGroups(ads);assert.equal(groups.length,2);assert.equal(groups[0].spend,9253.59);assert.equal(groups[1].spend,12);assert.equal(spendGroups(ads,true).length,3);
 const view=overviewMarkup({projects:[p],summaries:new Map([[p.slug,{ads,crm:{available:true,qualified:0,sales:0}}]]),slug:p.slug});assert.match(view.metrics,/Meta Ads/);assert.match(view.metrics,/Google Ads/);assert.match(view.metrics,/CZK/);assert.match(view.metrics,/USD/);assert.match(view.projectPanel,/AM &lt;Klinika&gt;/);assert.equal((view.metrics.match(/<article/g)||[]).length,4);assert.equal(view.crmAvailable,true);
});
test('overview shows unknown or restricted metrics as unavailable and reports integration issues without inventing zeros',()=>{
 const restricted={...p,canCRM:false,deliveryIssues:2,imports:[{provider:'google_ads',state:'error'}]};const view=overviewMarkup({projects:[restricted],summaries:new Map([[p.slug,{ads:[],crm:{available:false,restricted:true}}]]),slug:p.slug});assert.equal((view.metrics.match(/class="value">—/g)||[]).length,4);assert.doesNotMatch(view.projectPanel,/href="#crm/);assert.equal(view.crmAvailable,false);assert.match(view.health,/ошибка загрузки/);assert.match(view.health,/2 событий CRM/);
 const waiting=overviewMarkup({projects:[p],summaries:new Map(),slug:p.slug});assert.match(waiting.health,/Загружаем состояние/);assert.equal(spendGroups([{currency:'CZK',spend:null}]).length,0);
});
