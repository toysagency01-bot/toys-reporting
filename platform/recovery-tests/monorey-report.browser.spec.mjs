import {test,expect} from '@playwright/test';
import {projectFixture} from './project-design-fixture.mjs';
test('Monorey renders manual campaign leads once, with unchanged Meta expenses',async({page,request})=>{
 await page.clock.setFixedTime(new Date('2026-10-30T10:00:00Z'));await projectFixture({page,request,slug:'monorey-acdk'});
 await page.route(/\/(?:ads-summary|content-project\/ads\/hierarchy)\?/,async route=>{
  const u=new URL(route.request().url()),m=v=>({state:'observed',value:String(v)});
  await route.fulfill({json:{ok:true,manualReport:{available:true,status:'success'},reportConversions:[{date:'2026-10-30',campaign:'Campaign',conversions:2}],providers:[{provider:'meta_ads',integrationId:'int_monorey_meta',coverage:'complete',coveredDates:['2026-10-30'],requestedRange:{from:u.searchParams.get('from'),to:u.searchParams.get('to')},freshness:'fresh',hierarchy:{providerId:'1139444467187528',currency:'EUR',children:[{providerId:'campaign',name:'Campaign',children:[],dailyMetrics:[{date:'2026-10-30',metrics:{spend:m(5),impressions:m(100),clicks:m(10),conversions:m(1)}}]}]}}]}});
 });
 await page.route('**/top-creatives?*',r=>r.fulfill({json:{ok:true,rankings:{}}}));
 await page.goto('/monorey-acdk/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await expect.poll(()=>page.locator('#kConv').evaluate(e=>e.childNodes[0].textContent.trim())).toBe('2');await expect(page.locator('#kSpend')).toContainText('5');await expect(page.locator('#platformReportConversions')).toContainText('заменяют результат Meta');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
