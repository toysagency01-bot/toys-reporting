import {test,expect} from '@playwright/test';
for(const mobile of [false,true])test(`advertising periods use the same project calendar and preserve cents (${mobile?'mobile':'desktop'})`,async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-21T16:07:00Z'));await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/content-project/ads/hierarchy?*',route=>{
  const url=new URL(route.request().url()),requestedRange={from:url.searchParams.get('from'),to:url.searchParams.get('to')};const observed=n=>({value:String(n),state:'observed'});
  const dailyMetrics=Array.from({length:30},(_,i)=>{const date=new Date(Date.parse('2026-10-21T12:00Z')-i*86400000).toISOString().slice(0,10);return {date,metrics:{impressions:observed(100),clicks:observed(10),spend:observed(10.25),conversions:observed(2)}};}).filter(d=>d.date>=requestedRange.from&&d.date<=requestedRange.to);
  return route.fulfill({json:{ok:true,providers:[{provider:'meta_ads',freshness:'fresh',requestedRange,hierarchy:{currency:'USD',children:[{providerId:'periods',name:'Synthetic periods',dailyMetrics,children:[]}]}}]}});
 });
 await page.goto('/api/v2/projects/housevip-cxp7/content-project');await expect(page.locator('#kSpend')).toContainText('71,75');
 for(const [days,from,spend,conversions] of [['1','2026-10-21','10,25','2'],['7','2026-10-15','71,75','14'],['30','2026-09-22','307,5','60'],['7','2026-10-15','71,75','14']]){
  await page.locator(`#periodSeg [data-days="${days}"]`).click();await expect(page.locator('#dateFrom')).toHaveValue(from);await expect(page.locator('#dateTo')).toHaveValue('2026-10-21');await expect(page.locator('#kSpend')).toContainText(spend);await expect(page.locator('#kConv')).toContainText(conversions);
 }
 await page.reload();await page.locator('#periodSeg [data-days="7"]').click();await expect(page.locator('#dateFrom')).toHaveValue('2026-10-15');await expect(page.locator('#dateTo')).toHaveValue('2026-10-21');await expect(page.locator('#kSpend')).toContainText('71,75');await expect(page.locator('#updated')).toHaveText('данные по 2026-10-21');
 expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`/tmp/advertising-periods-${mobile?'mobile':'desktop'}.png`});
});
