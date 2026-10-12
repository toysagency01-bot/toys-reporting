import {test,expect} from '@playwright/test';
const portal='/api/v2/projects/housevip-cxp7/content-project';
test('mounted portal renders Golos with the generic asset route unavailable',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('/mvp'+portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await expectGolos(page);
 expect(requests.some(u=>u.includes('/api/ui/')||u.includes('platform-fonts.css')||u.includes('fonts.googleapis'))).toBe(false);
 await expect(page.locator('body')).not.toContainText('Не удалось загрузить борд');expect(errors).toEqual([]);
});
async function expectGolos(page){
 await page.evaluate(()=>document.fonts.ready);
 expect(await page.evaluate(()=>[400,500,600,700,800].every(w=>document.fonts.check(`${w} 14px "Golos Text"`,'Обзор TOYS')))).toBe(true);
 const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
 const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'.ux-page-heading h1'});
 const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});expect(fonts.some(f=>f.isCustomFont&&/Golos/i.test(f.familyName))).toBe(true);await cdp.detach();
}
test('dashboard and durable weekly workflow',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await expectGolos(page);
 await expect(page.locator('#dateFrom')).toHaveCount(1);
 await page.screenshot({path:'dist/desktop.png',fullPage:true,animations:'disabled'});
 await page.locator('[data-ux-view="project"]').click();await page.locator('#uxProjectChannels [data-channel="meta"],#uxProjectChannels [data-legacy-view="meta"]').first().click();await expect(page.locator('#projectView')).toContainText('Подготовить новые креативы');
 await page.locator('[data-ux-view="weekly"]').click();await expect(page.locator('#weeklyForm')).toBeVisible();
 await page.locator('[name="summary"]').fill('Проверка сохранения из браузера');
 await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click();
 await expect(page.locator('#weeklyMessage')).toContainText('Черновик сохранён');
 await page.reload();await expect(page.locator('[name="summary"]')).toHaveValue('Проверка сохранения из браузера');
 await page.getByRole('button',{name:'Сохранить и опубликовать',exact:true}).click();
 await expect(page.locator('#weeklyMessage')).toContainText('Отчёт опубликован');
 await page.locator('#commentForm textarea').fill('Комментарий из браузера');await page.getByRole('button',{name:'Добавить комментарий',exact:true}).click();
 await expect(page.locator('#commentsList')).toContainText('Комментарий из браузера');
 await page.getByRole('button',{name:'История',exact:true}).click();await expect(page.locator('#historyContent')).toContainText('Версия');await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await page.locator('[data-ux-view="project"]').click();await page.locator('[data-platform-creatives]').click();await expect(page.locator('#creativeContent')).toContainText('ожидает подключения хранилища');
 expect(errors).toEqual([]);
});
test('mobile navigation stays within viewport',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto(portal);await expect(page.locator('#mainCards')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'dist/mobile.png',fullPage:true,animations:'disabled'});});
test('native cards refresh once, expose groups and retain usable data after a failed refresh',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let calls=0;
 const observed=value=>({value:String(value),state:'observed'});
 await page.route('**/content-project/ads/hierarchy?*',async route=>{
  const url=new URL(route.request().url());calls++;
  const metrics={impressions:observed(120),clicks:observed(9),spend:observed(100),conversions:{value:null,state:'unsupported'}};
  await route.fulfill({json:{ok:true,providers:[{provider:'meta_ads',integrationId:'test',freshness:'fresh',requestedRange:{from:url.searchParams.get('from'),to:url.searchParams.get('to')},hierarchy:calls===1?{currency:'IDR',children:[{providerId:'live',name:'Обновлённая кампания',dailyMetrics:[{date:'2026-10-07',metrics}],children:[{providerId:'group',name:'Группа объявлений',dailyMetrics:[{date:'2026-10-07',metrics}]}]}]}:null}]}});
 });
 await page.clock.install();await page.goto(portal);await expect(page.locator('#platformNotice')).toContainText('обновлено');
 await expect(page.locator('#kClicks')).toHaveText('9');await expect(page.locator('#kConv')).toHaveText('—');
 await page.locator('#uxNav [data-ux-view="campaigns"]').click();await expect(page.locator('#campList')).toContainText('Обновлённая кампания');
 await page.locator('.platform-drilldown > summary').click();await expect(page.locator('.platform-child')).toContainText('Группа объявлений');
 await page.clock.fastForward(20*60*1000);await expect(page.locator('#platformNotice')).toContainText('подключение не завершено');
 await expect(page.locator('#kClicks')).toHaveText('9');expect(errors).toEqual([]);
});
for(const slug of ['karlovarska-sul-k4rm','profkit-instashop-r4vk'])test(slug+' retains original board sections and icons',async({page,request})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const d=await(await request.get('/api/v2/projects/housevip-cxp7/dashboard')).json();const original=d.dashboard.facts.rows[0];
 const observed=(metricCode,value,currency=null)=>({metricCode,value:String(value),state:'observed',currency});
 d.dashboard.project.slug=slug;d.dashboard.project.name=slug==='karlovarska-sul-k4rm'?'Karlovarska Sul':'PROFKIT';
 if(slug.startsWith('karl')){d.dashboard.advertising={channels:{meta:d.dashboard.facts,google:d.dashboard.facts}};const rows=[{date:original.date,platform:'Meta Ads',metrics:[observed('ecom.purchases',2),observed('ecom.purchase_value',200,'EUR'),observed('ecom.add_to_cart',5),observed('ecom.checkout',3)]}];rows.push({...rows[0],platform:'Google Ads'});d.dashboard.ecommerce={account:{rows},campaigns:{rows:rows.map(r=>({...r,campaign:{label:'Тестовая кампания'}}))}};}
 else{d.dashboard.instashop={ads:{rows:[{...original,metrics:[observed('ads.spend_uah',410,'UAH'),observed('ads.raw_spend_usd',10,'USD'),observed('ads.impressions',1000),observed('ads.clicks',25),observed('instashop.meta_direct',4)]}]},sales:{rows:[{date:original.date,metrics:[observed('instashop.sales_count',2),observed('instashop.revenue_uah',1000,'UAH'),observed('instashop.direct_inquiries',10),observed('instashop.qualified_inquiries',8),observed('instashop.unqualified_inquiries',2)]}]}};}
 await page.route('**/projects/'+slug+'/dashboard',r=>r.fulfill({json:d}));
 await page.route('**/projects/'+slug+'/content/tabs',r=>r.fulfill({json:{ok:true,tabs:[]}}));
 await page.route('**/projects/'+slug+'/weekly-reports',r=>r.fulfill({json:{ok:true,reports:[]}}));
 await page.goto('/mvp/'+slug+'/#section=overview&view=account');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await expect(page.locator('#uxOverview')).toBeVisible();await expect(page.locator('#uxInsightTitle')).toBeVisible();
 await expect(page.locator('#uxNav [data-ux-view="overview"] svg')).toHaveCount(1);
 await expect(page.locator('header img')).toHaveAttribute('src',/\?ui=assets%2Ftoys-logo.svg/);
 await expect(page.locator('#toysThemeToggle')).toBeVisible();
 await expectGolos(page);
 if(slug.startsWith('karl')){await expect(page.locator('#ecomFunnelCards .card').filter({has:page.locator('.label',{hasText:/^ROAS$/})}).locator('.value')).toHaveText(['—','—']);await expect(page.locator('#ecomTopCards > .ecom-channel > .platform-top-creatives')).toHaveCount(2);}
 await page.screenshot({path:'dist/'+slug+'.png',fullPage:true,animations:'disabled'});
 await page.locator('#uxNav [data-ux-view="campaigns"]').click();await expect(page.locator('#uxCampaigns')).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
test('brand calendar, today, light logo and creative metric switches',async({page})=>{
 await page.goto(portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await expect(page.getByRole('button',{name:'Обновить',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Вчера',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Сегодня',exact:true}).click();const today=await page.evaluate(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));await expect(page.locator('#dateFrom')).toHaveValue(today);await expect(page.locator('#dateTo')).toHaveValue(today);
 await page.locator('#platformCalendar').click();await expect(page.getByRole('dialog',{name:'Выбор периода'})).toBeVisible();await page.locator('[data-date="2026-10-07"]').click();await page.locator('[data-date="2026-10-09"]').click();await page.getByRole('button',{name:'Применить',exact:true}).click();await expect(page.locator('#dateFrom')).toHaveValue('2026-10-07');await expect(page.locator('#dateTo')).toHaveValue('2026-10-09');
 await page.locator('#toysThemeToggle').click();await expect(page.locator('header img[alt="TOYS"]')).toHaveAttribute('src',/toys-black.svg/);expect(await page.locator('#kClicks').evaluate(e=>getComputedStyle(e).fontWeight)).toBe('600');expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#26ddcc');
 await page.locator('[data-ranking="qualifiedLeads"]').click();await expect(page.locator('[data-ranking="qualifiedLeads"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.top-basis')).toContainText('Нет данных');
 await page.screenshot({path:'dist/light-updates.png',fullPage:true,animations:'disabled'});await page.locator('#platformCalendar').click();await page.screenshot({path:'dist/calendar-updates.png',animations:'disabled'});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('creative cards reorder on metric switch and exclude unsupported qualifications',async({page})=>{
 const observed=value=>({value:String(value),state:'observed'});
 await page.route('**/content-project/ads/hierarchy?*',route=>{const u=new URL(route.request().url());const requestedRange={from:u.searchParams.get('from'),to:u.searchParams.get('to')};const date=requestedRange.from;const metrics={impressions:observed(100),clicks:observed(12),spend:observed(10),conversions:{value:null,state:'unsupported'}};
 const ads=[['Лучший по лидам',10,1,20],['Лучший по продажам',1,8,30],['Лучший по ROAS',2,2,100]].map(([name,leads,purchases,purchaseValue],i)=>({level:'ad',providerId:String(i),name,dailyMetrics:[{date,metrics}],outcomeDaily:[{date,metrics:{leads:observed(leads),purchases:observed(purchases),purchaseValue:observed(purchaseValue)}}]}));
 return route.fulfill({json:{ok:true,providers:[{provider:'meta_ads',integrationId:'test',freshness:'fresh',requestedRange,hierarchy:{currency:'IDR',children:[{providerId:'campaign',name:'Кампания',dailyMetrics:[{date,metrics}],children:[{children:ads}]}]}}]}});});
 await page.goto(portal);await expect(page.locator('.top-creative')).toHaveCount(3);await expect(page.locator('.top-creative h3').first()).toHaveText('Лучший по лидам');await page.locator('[data-ranking="roas"]').click();await expect(page.locator('.top-creative h3').first()).toHaveText('Лучший по ROAS');await page.locator('[data-ranking="purchases"]').click();await expect(page.locator('.top-creative h3').first()).toHaveText('Лучший по продажам');await page.locator('[data-ranking="qualifiedLeads"]').click();await expect(page.locator('.top-creative')).toHaveCount(0);
});
