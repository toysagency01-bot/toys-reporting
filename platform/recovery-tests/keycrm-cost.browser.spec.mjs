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
