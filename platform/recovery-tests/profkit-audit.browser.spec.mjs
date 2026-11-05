import {test,expect} from '@playwright/test';
import {projectFixture} from './project-design-fixture.mjs';
async function wire(page,request,rate,{sales=25,revenue=75909}={}){
 const slug='profkit-instashop-r4vk';const {data}=await projectFixture({page,request,slug});
 const m=(metricCode,value,currency=null)=>({metricCode,value:value==null?null:String(value),state:value==null?'missing':'observed',currency});
 data.dashboard.instashop.ads.rows=[];
 data.dashboard.instashop.sales.rows=[{date:'2026-10-29',metrics:[]},{date:'2026-11-04',metrics:[m('instashop.direct_inquiries',10),m('instashop.qualified_inquiries',null),m('instashop.unqualified_inquiries',null),m('instashop.sales_count',sales),m('instashop.revenue_uah',revenue,'UAH')]}];
 await page.route(/\/(?:ads-summary|content-project\/ads\/hierarchy)\?/,async route=>{
  const url=new URL(route.request().url()),range={from:url.searchParams.get('from'),to:url.searchParams.get('to')},observed=value=>({state:'observed',value:String(value)});
  await route.fulfill({json:{ok:true,providers:[{provider:'meta_ads',integrationId:'native-meta-profkit-usa-2',freshness:'fresh',coverage:'complete',requestedRange:range,coveredDates:Array.from({length:Math.round((Date.parse(range.to)-Date.parse(range.from))/86400000)+1},(_,i)=>new Date(Date.parse(range.from)+i*86400000).toISOString().slice(0,10)),hierarchy:{providerId:'1736244500266269',currency:'USD',timezone:'Europe/Kiev',dailyMetrics:[],children:[{providerId:'new-campaign',name:'New account',children:[],dailyMetrics:[{date:'2026-11-04',metrics:{spend:observed(20),impressions:observed(1000),clicks:observed(65),conversions:observed(8)}}]}]}}],exchangeRates:rate?[{date:'2026-11-04',rate}]:[],crm:{available:false}}});
 });
 await page.route('**/top-creatives?*',r=>r.fulfill({json:{ok:true,rankings:{}}}));
 return data;
}
const values=page=>page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#cards .card')].map(c=>[c.querySelector('.label')?.textContent.trim(),c.querySelector('.value')?.textContent.trim()])));
for(const width of [1440,390])test(`Profkit shows actual client counts and no invented qualifications at ${width}px`,async({page,request})=>{
 await page.clock.setFixedTime(new Date('2026-11-04T10:00:00Z'));await page.setViewportSize({width,height:950});await wire(page,request,45);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/profkit-instashop-r4vk/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await expect.poll(async()=>(await values(page))['Клики']).toBe('65');const v=await values(page);expect(v['Direct-обращения']).toMatch(/^10/);expect(v['Продажи']).toBe('25');expect(v).not.toHaveProperty('Квал. обращения');expect(v).not.toHaveProperty('Цена квала');expect(v['Расход']).toMatch(/900/);
 expect(v['Цена продажи']).toMatch(/^36\s*₴/);expect(v.ROAS).toMatch(/^84[.,]34/);expect(v['Цена продажи']).toContain('Предварительно');expect(v.ROAS).toContain('Предварительно');await expect(page.locator('#novaMetricGroups')).toContainText('Предварительно');
 await expect(page.locator('#uxInsightText')).toHaveText('Предварительный ROAS — 84.34×.');
 await expect(page.locator('#platformSalesCoverage')).toContainText('предваритель');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);await page.screenshot({path:`/tmp/profkit-audit-${width}.png`,fullPage:true});
});
test('missing FX retains current impressions/clicks and hides unavailable UAH cost',async({page,request})=>{
 await page.clock.setFixedTime(new Date('2026-11-04T10:00:00Z'));await wire(page,request,null);await page.goto('/profkit-instashop-r4vk/');await expect.poll(async()=>(await values(page))['Клики']).toBe('65');
 expect((await values(page))['Расход']).toBe('—');await expect(page.locator('#platformSalesCoverage')).toContainText('нет подтверждённого курса');
 expect((await values(page))['Цена продажи']).toBe('—');expect((await values(page)).ROAS).toBe('—');
});
test('a fully filled selected day shows final ratios without the provisional marker',async({page,request})=>{
 await page.clock.setFixedTime(new Date('2026-11-04T10:00:00Z'));await wire(page,request,45);await page.goto('/profkit-instashop-r4vk/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await page.locator('#from').fill('2026-11-04');
 await expect.poll(async()=>(await values(page))['Цена продажи']).toBe('36 ₴');expect((await values(page)).ROAS).toBe('84.34×');await expect(page.locator('#cards .instashop-provisional')).toHaveCount(0);
 await expect(page.locator('#uxInsightText')).toHaveText('ROAS — 84.34×.');
});
for(const [name,sales,revenue,price,roas]of [['sales without revenue',25,null,/^36\s*₴/,'—'],['revenue without a sales count',null,75909,'—',/^84[.,]34/],['observed zero revenue',0,0,'—',/^0[.,]00/]])test(`ratios use independent business inputs: ${name}`,async({page,request})=>{
 await page.clock.setFixedTime(new Date('2026-11-04T10:00:00Z'));await wire(page,request,45,{sales,revenue});await page.goto('/profkit-instashop-r4vk/');await expect.poll(async()=>(await values(page))['Клики']).toBe('65');const v=await values(page);if(price instanceof RegExp)expect(v['Цена продажи']).toMatch(price);else expect(v['Цена продажи']).toBe(price);if(roas instanceof RegExp)expect(v.ROAS).toMatch(roas);else expect(v.ROAS).toBe(roas);
});
