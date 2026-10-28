import {test,expect} from '@playwright/test';
import {projectFixture} from './project-design-fixture.mjs';

test('KeyCRM qualifications and cost stay together and update with period, spend and zero qualifications',async({page,request})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await projectFixture({page,request,slug:'housevip-cxp7'});
 let qualified=5,spend=2500;
 await page.route('**/projects/housevip-cxp7/crm/summary?*',r=>r.fulfill({json:{ok:true,available:true,source:'keycrm',qualificationOnly:true,qualified,sales:null,revenue:[],timeZone:'Europe/Warsaw',coverage:{sourceFilter:{utm_source:'toys'}}}}));
 await page.route(/\/projects\/housevip-cxp7\/(content-project\/ads\/hierarchy|ads-summary)\?/,r=>{
  const q=new URL(r.request().url()).searchParams,range={from:q.get('from'),to:q.get('to')},m=value=>({state:'observed',value:String(value)});
  return r.fulfill({json:{ok:true,providers:[{provider:'meta_ads',requestedRange:range,freshness:'fresh',hierarchy:{currency:'PLN',children:[{providerId:'one',name:'Synthetic',dailyMetrics:[{date:range.to,metrics:{spend:m(spend),impressions:m(1000),clicks:m(100),conversions:m(13)}}]}]}}]}});
 });
 await page.goto('/housevip-cxp7/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 const crm=page.locator('#novaMetricGroups .nova-metric').filter({has:page.locator('.nova-metric-label',{hasText:'Квал-лиды CRM'})}),cost=page.locator('#novaMetricGroups .nova-metric').filter({has:page.locator('.nova-metric-label',{hasText:'Стоимость квала'})});
 await expect(crm.locator('.nova-metric-value')).toHaveText('5');await expect(cost.locator('.nova-metric-value')).toHaveText(/500\s*zł/);
 expect(await crm.evaluate(e=>e.closest('[data-nova-group]').dataset.novaGroup)).toBe(await cost.evaluate(e=>e.closest('[data-nova-group]').dataset.novaGroup));
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await expect(cost).toBeVisible();await expect.poll(async()=>Math.abs((await crm.boundingBox()).y-(await cost.boundingBox()).y)).toBeLessThan(2);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`/tmp/keycrm-cost-${width}.png`,fullPage:true});}
 qualified=2;spend=1400;await page.locator('#periodSeg [data-days="7"]').click();await expect(crm.locator('.nova-metric-value')).toHaveText('2');await expect(cost.locator('.nova-metric-value')).toHaveText(/700\s*zł/);
 qualified=0;await page.locator('#periodSeg [data-days="30"]').click();await expect(crm.locator('.nova-metric-value')).toHaveText('0');await expect(cost.locator('.nova-metric-value')).toHaveText('—');expect(errors).toEqual([]);
});

test('connected CRM adds campaign qualification counts, cost and sorting on desktop and mobile',async({page,request})=>{
 await projectFixture({page,request,slug:'housevip-cxp7'});
 const key=n=>String(n).padStart(64,'0'),rows=[
  {key:key(1),parentKey:'',name:'Consultation',level:'campaign',provider:'meta_ads',currency:'PLN',childCount:1,metrics:{spend:200,conversions:13,qualifiedLeads:4,cpql:50}},
  {key:key(2),parentKey:'',name:'Quiz',level:'campaign',provider:'meta_ads',currency:'PLN',childCount:0,metrics:{spend:300,conversions:20,qualifiedLeads:2,cpql:150}},
  {key:key(3),parentKey:'',name:'Unknown campaign',level:'campaign',provider:'meta_ads',currency:'PLN',childCount:0,metrics:{spend:10,conversions:0,qualifiedLeads:null,cpql:null}},
  {key:key(4),parentKey:key(1),name:'Group',level:'group',provider:'meta_ads',currency:'PLN',childCount:0,metrics:{spend:200,conversions:13,qualifiedLeads:null,cpql:null}}
 ];let reads=0;
 await page.route('**/projects/housevip-cxp7/campaign-browser?*',r=>{reads++;return r.fulfill({json:{ok:true,rows:rows.slice(0,3),total:3,nextOffset:null,sources:[],crmQualification:{enabled:true,status:'partial',qualified:7,matched:6,unmatched:1,detailLevel:'campaign'},dataset:{rows,complete:true,completeParents:['',key(1),key(2),key(3),key(4)]}}});});
 await page.goto('/housevip-cxp7/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await page.getByRole('button',{name:'Максимум',exact:true}).click();await page.locator('#uxNav [data-ux-view=campaigns]').click();
 const row=n=>page.locator(`[data-node="${key(n)}"]`),metric=(n,label)=>row(n).locator('> .campaign-row .campaign-cell').filter({has:page.locator('span',{hasText:new RegExp('^'+label+'$')})}).locator('b');
 await expect(metric(1,'Квал-лиды CRM')).toHaveText('4');await expect(metric(1,'Стоимость квала')).toHaveText(/50\s*zł/);await expect(metric(2,'Стоимость квала')).toHaveText(/150\s*zł/);await expect(metric(3,'Квал-лиды CRM')).toHaveText('—');
 await expect(page.locator('.campaign-source-note')).toContainText('Без привязки к строкам кампаний: 1');
 const select=page.getByRole('combobox',{name:'Сортировка кампаний'});await select.selectOption('cpql');await expect(page.locator('.campaign-list > .campaign-entity').first()).toHaveAttribute('data-node',key(1));expect(reads).toBe(1);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await expect(metric(1,'Стоимость квала')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`/tmp/keycrm-campaigns-${width}.png`,fullPage:true});
 }
 await row(1).locator('> .campaign-row .campaign-node-open').click();await expect(metric(4,'Квал-лиды CRM')).toHaveText('—');await expect(metric(4,'Стоимость квала')).toHaveText('—');expect(reads).toBe(1);
});
