import {test,expect} from '@playwright/test';
import {rankCreatives} from '../native/top-creatives.js';
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
 await page.locator('[data-ux-view="project"]').click();await page.locator('#uxProjectChannels [data-legacy-view="meta"],#uxProjectChannels [data-channel="meta"]').first().click();await expect(page.locator('#creativeContent')).toContainText('ожидает подключения хранилища');
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
 if(slug.startsWith('karl')){await expect(page.locator('#ecomFunnelCards .card').filter({has:page.locator('.label',{hasText:/^ROAS$/})}).locator('.value')).toHaveText(['—','—']);await expect(page.locator('#ecomTopCards > .ecom-channel > .platform-top-creatives')).toHaveCount(2);
 for(const [channel,provider]of [['Google Ads','google_ads'],['Meta Ads','meta_ads'],['Google Ads','google_ads']]){await page.locator(`#platformSeg [data-platform="${channel}"]`).click();await expect(page.locator('.platform-top-creatives')).toHaveCount(1);await expect(page.locator('.platform-top-creatives')).toHaveAttribute('data-provider',provider);await expect(page.locator('#ecomTopCards > .ecom-channel > .platform-top-creatives')).toHaveCount(1);}
 await page.locator('#platformSeg [data-platform="__all"]').click();await expect(page.locator('.platform-top-creatives')).toHaveCount(2);}
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
 await page.locator('[data-ranking="qualifiedLeads"]').click();await expect(page.locator('[data-ranking="qualifiedLeads"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.top-basis')).toContainText(/Нет данных|не подключена/);
 await page.screenshot({path:'dist/light-updates.png',fullPage:true,animations:'disabled'});await page.locator('#platformCalendar').click();await page.screenshot({path:'dist/calendar-updates.png',animations:'disabled'});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('creative cards reorder on metric switch and exclude unsupported qualifications',async({page})=>{
 const observed=value=>({value:String(value),state:'observed'});
 await page.route('**/top-creatives?*',route=>{const u=new URL(route.request().url());const requestedRange={from:u.searchParams.get('from'),to:u.searchParams.get('to')};const date=requestedRange.from;const metrics={impressions:observed(100),clicks:observed(12),spend:observed(10),conversions:{value:null,state:'unsupported'}};
 const ads=[['Лучший по лидам',10,1,20],['Лучший по продажам',1,8,30],['Лучший по ROAS',2,2,100]].map(([name,leads,purchases,purchaseValue],i)=>({level:'ad',providerId:String(i),name,dailyMetrics:[{date,metrics}],outcomeDaily:[{date,metrics:{leads:observed(leads),purchases:observed(purchases),purchaseValue:observed(purchaseValue)}}]}));
 const providers=[{provider:'meta_ads',integrationId:'test',freshness:'fresh',requestedRange,hierarchy:{currency:'IDR',children:[{providerId:'campaign',name:'Кампания',dailyMetrics:[{date,metrics}],children:[{children:ads}]}]}}];return route.fulfill({json:{ok:true,rankings:Object.fromEntries(['roas','purchases','leads','qualifiedLeads'].map(b=>[b,rankCreatives(providers,requestedRange,b)]))}});});
 await page.goto(portal);await expect(page.locator('.top-creative')).toHaveCount(3);await expect(page.locator('.top-creative h3').first()).toHaveText('Лучший по лидам');await page.locator('[data-ranking="roas"]').click();await expect(page.locator('.top-creative h3').first()).toHaveText('Лучший по ROAS');await page.locator('[data-ranking="purchases"]').click();await expect(page.locator('.top-creative h3').first()).toHaveText('Лучший по продажам');await page.locator('[data-ranking="qualifiedLeads"]').click();await expect(page.locator('.top-creative')).toHaveCount(0);
});

test('public short board requests creative rankings without requesting private hierarchy',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-public':'true'});const seen=[];page.on('request',r=>seen.push(r.url()));
 await page.route('**/top-creatives?*',r=>r.fulfill({json:{ok:true,rankings:{leads:[{provider:'meta_ads',rows:[{name:'Публичный креатив',score:4,ctr:2,spend:100,currency:'IDR',freshness:'fresh'}]}]}}}));
 await page.goto('/mvp/housevip-cxp7/#overview');await expect(page.locator('.top-creative h3')).toHaveText('Публичный креатив');expect(seen.some(u=>u.includes('/top-creatives?'))).toBe(true);expect(seen.some(u=>u.includes('/ads/hierarchy'))).toBe(false);
});
test('dashboard shell is visible while data is pending, without an entry loading screen',async({page})=>{
 let release;const gate=new Promise(resolve=>release=resolve);await page.route('**/dashboard',async route=>{await gate;await route.continue();});
 await page.goto('/mvp/housevip-cxp7/#overview',{waitUntil:'domcontentloaded'});
 await expect(page.locator('header')).toBeVisible();await expect(page.locator('#uxNav')).toBeVisible();await expect(page.locator('#uxOverview')).toBeVisible();await expect(page.locator('#mainCards')).toBeVisible();await expect(page.getByText('Загружаю данные…',{exact:true})).not.toBeVisible();
 await expect(page.locator('body')).toHaveAttribute('data-platform-loading','true');release();await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await expect(page.locator('#kClicks')).toHaveText('25');
});

test('Today in the public board loads current-day advertising instead of stopping at the snapshot',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-public':'true'});
 await page.route('**/ads-summary?*',route=>{const u=new URL(route.request().url()),range={from:u.searchParams.get('from'),to:u.searchParams.get('to')};const m=v=>({value:String(v),state:'observed'});return route.fulfill({json:{ok:true,providers:[{provider:'meta_ads',freshness:'fresh',requestedRange:range,hierarchy:{currency:'IDR',children:[{providerId:'today',name:'Сегодня',dailyMetrics:[{date:range.from,metrics:{impressions:m(200),clicks:m(17),spend:m(900),conversions:m(3)}}]}]}}]}});});
 await page.goto('/mvp/housevip-cxp7/#overview');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await page.getByRole('button',{name:'Сегодня',exact:true}).click();await expect(page.locator('#kClicks')).toHaveText('17');await expect(page.locator('#content')).toBeVisible();await expect(page.locator('#emptyState')).not.toBeVisible();
});
test('creative approval block is inside Project Meta and absent from other project channels',async({page})=>{
 await page.goto(portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await page.locator('[data-ux-view="project"]').click();
 await page.locator('#uxProjectChannels [data-legacy-view="meta"],#uxProjectChannels [data-channel="meta"]').first().click();await expect(page.locator('#platformCreatives')).toBeVisible();await expect(page.locator('[data-platform-creatives]')).toHaveCount(0);
 await page.locator('#uxProjectChannels [data-legacy-view="smm"],#uxProjectChannels [data-channel="smm"]').first().click();await expect(page.locator('#platformCreatives')).not.toBeVisible();
});
test('signed-in client sees only review actions and sends the displayed version with a decision',async({page})=>{
 let decision=null,state='in_review';const id='synthetic-creative';
 await page.route('**/content-project/creatives',r=>r.fulfill({json:{ok:true,access:{role:'viewer'},storage:{available:true},creatives:[{id,fileName:'Креатив Meta',kind:'image',uploadState:'ready',status:state,statusVersion:2}]}}));
 await page.route('**/content-project/creatives/'+id+'/preview',r=>r.fulfill({status:204}));
 await page.route('**/content-project/creatives/'+id,r=>{decision=r.request().postDataJSON();state=decision.status;return r.fulfill({json:{ok:true}});});
 await page.goto(portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await page.locator('[data-ux-view="project"]').click();await page.locator('#uxProjectChannels [data-legacy-view="meta"],#uxProjectChannels [data-channel="meta"]').first().click();
 await expect(page.locator('#uploadFile')).toHaveCount(0);await expect(page.locator('[data-status="archived"]')).toHaveCount(0);await page.locator('.review-reason').fill('Заменить заголовок');await page.locator('[data-status="rejected"]').click();await expect.poll(()=>decision?.status).toBe('rejected');expect(decision.expectedVersion).toBe(2);expect(decision.reason).toBe('Заменить заголовок');await expect(page.locator('.creative-card .badge')).toHaveText('Нужны изменения');
});


test('master keeps Home and CRM separate; create, qualify and sell a lead persist across reload',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/mvp/master/');await expect(page.locator('#projectSelect')).toContainText('HOUSEVIP');
 await expect(page.locator('.master-sidebar')).toBeVisible();await expect(page.locator('#home')).toBeVisible();await expect(page.locator('#crm')).toBeHidden();
 await page.locator('[data-view="crm"]').click();await expect(page.locator('#crm')).toBeVisible();await expect(page.locator('#home')).toBeHidden();
 await page.locator('#newLead').click();await page.locator('[name="name"]').fill('Synthetic CRM Browser');await page.locator('[name="email"]').fill('crm-browser@example.test');await page.getByRole('button',{name:'Добавить',exact:true}).click();
 await expect(page.locator('#leadsTable')).toContainText('Synthetic CRM Browser');await page.getByRole('button',{name:'Synthetic CRM Browser',exact:true}).click();await page.locator('[name="status"]').selectOption('Квалифицирован');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(page.locator('#crmSummary')).toContainText('1');
 await page.reload();await expect(page.locator('#leadsTable')).toContainText('Квалифицирован');await page.getByRole('button',{name:'Synthetic CRM Browser',exact:true}).click();await page.locator('[name="status"]').selectOption('Продажа');await page.locator('[name="value"]').fill('150');await page.locator('[name="currency"]').fill('EUR');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(page.locator('#crmSummary')).toContainText('150 EUR');
 await page.screenshot({path:'dist/master-crm.png',fullPage:true,animations:'disabled'});await page.locator('#theme').click();await expect(page.locator('#brandLogo')).toHaveAttribute('src',/toys-black/);expect(errors).toEqual([]);
});

test('client keeps Home and CRM mounted, caches leads and preserves period and filters without document reloads',async({page})=>{
 const calls=[],documents=[],urls=[];page.on('request',r=>{calls.push(new URL(r.url()).pathname);urls.push(r.url());if(r.isNavigationRequest())documents.push(r.url());});
 await page.goto('/mvp'+portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 const marker=await page.evaluate(()=>window.navigationTestMarker=crypto.randomUUID());const period=await page.locator('body > :not(#platformClientCRM) #dateFrom').inputValue();
 await page.locator('#platformCRMNav').click();await expect(page.locator('#heading')).toHaveText('CRM');
 await expect(page.locator('#projectSelect')).toBeHidden();await expect(page.locator('#connections')).toBeHidden();
 await expect(page.locator('#leadsTable')).not.toBeEmpty();expect(calls.some(p=>p.includes('/master'))).toBe(false);
 await page.locator('#statusFilter').selectOption('Квалифицирован');await expect(page.locator('#leadsTable')).not.toBeEmpty();
 // Wait for the new filter request, then ensure a quick round trip uses memory.
 await expect.poll(()=>calls.filter(p=>p.endsWith('/crm')).length).toBe(2);await page.waitForTimeout(100);
 const requests=calls.length;
 await page.getByRole('link',{name:'Главная',exact:true}).click();await expect(page).toHaveURL(/\/mvp\/housevip-cxp7\/(?:#overview)?$/);
 await expect(page.locator('body > :not(#platformClientCRM) #dateFrom')).toHaveValue(period);
 await page.locator('#platformCRMNav').click();await expect(page.locator('#statusFilter')).toHaveValue('Квалифицирован');await expect(page.locator('#leadsTable')).not.toBeEmpty();
 expect(await page.evaluate(()=>window.navigationTestMarker)).toBe(marker);expect(documents).toHaveLength(1);expect(urls.slice(requests)).toEqual([]);
 await page.goBack();await expect(page.locator('#platformClientCRM')).toBeHidden();await page.goForward();await expect(page.locator('#platformClientCRM')).toBeVisible();expect(documents).toHaveLength(1);
 await page.screenshot({path:'dist/client-crm-cached.png',fullPage:true,animations:'disabled'});
 await page.locator('#platformClientCRM #theme').click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.getByRole('link',{name:'Главная',exact:true}).click();await expect(page.locator('header img[alt="TOYS"]')).toHaveAttribute('src',/toys-black/);
 await page.locator('#platformCRMNav').click();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('direct client CRM link opens the unified screen, writes invalidate lead cache and update the board',async({page})=>{
 await page.goto('/mvp/api/v2/projects/housevip-cxp7/content-crm');await expect(page.locator('#heading')).toHaveText('CRM');await expect(page.locator('#leadsTable')).not.toBeEmpty();
 await page.locator('#newLead').click();await page.locator('[name="name"]').fill('Cache invalidation lead');await page.locator('[name="email"]').fill('cache@example.test');await page.getByRole('button',{name:'Добавить',exact:true}).click();
 await expect(page.locator('#leadsTable')).toContainText('Cache invalidation lead');await page.getByRole('button',{name:'Cache invalidation lead',exact:true}).click();await page.locator('[name="status"]').selectOption('Квалифицирован');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(page.locator('#leadsTable')).toContainText('Квалифицирован');
 await page.getByRole('link',{name:'Главная',exact:true}).click();await expect(page.locator('#platformCRMStats')).toContainText('Квал-лиды CRM');await page.locator('#platformCRMNav').click();await expect(page.locator('#leadsTable')).toContainText('Cache invalidation lead');
});

test('agency connection settings explain Make intake and do not require the direct Meta webhook',async({page})=>{
 await page.goto('/mvp/api/v2/master/view#crm');
 await page.locator('#connections').click();
 await expect(page.locator('#makeConnection')).toContainText('Meta Lead Ads через Make');
 await expect(page.locator('#makeConnection')).toContainText('/housevip-cxp7/meta-lead');
 await expect(page.locator('#makeConnection')).toContainText('Credentials');
 await expect(page.locator('#websiteKey')).toBeVisible();
 await expect(page.locator('#pageList')).toBeVisible();
 await expect(page.getByText('Только для прямого подключения:',{exact:false})).toBeHidden();
});

test('pending provider refresh automatically updates both statistics and creatives without a reload',async({page})=>{
 let stats=0,creatives=0;
 await page.setExtraHTTPHeaders({'x-test-public':'true'});
 await page.route('**/ads-summary?*',route=>{const u=new URL(route.request().url()),range={from:u.searchParams.get('from'),to:u.searchParams.get('to')};const pending=++stats===1,m=v=>({value:String(v),state:'observed'});return route.fulfill({json:{ok:true,refreshing:pending,providers:[{provider:'meta_ads',freshness:pending?'refreshing':'fresh',requestedRange:range,hierarchy:pending?null:{currency:'IDR',children:[{providerId:'live',name:'Updated',dailyMetrics:[{date:range.to,metrics:{impressions:m(200),clicks:m(88),spend:m(900),conversions:m(3)}}]}]}}]}});});
 await page.route('**/top-creatives?*',route=>{const pending=++creatives===1;return route.fulfill({json:{ok:true,refreshing:pending,rankings:{leads:[{provider:'meta_ads',rows:pending?[]:[{name:'Automatically refreshed creative',score:4,ctr:2,spend:100,currency:'IDR',freshness:'fresh'}]}]}}});});
 await page.clock.install();await page.goto('/mvp/housevip-cxp7/');
 await expect(page.locator('#platformNotice')).toContainText('Обновляем рекламные данные');await expect(page.locator('.top-basis')).toContainText('Обновляем креативы');
 await page.clock.fastForward(2000);await expect(page.locator('#kClicks')).toHaveText('88');await expect(page.locator('.top-creative h3')).toHaveText('Automatically refreshed creative');await expect(page.locator('#platformNotice')).toContainText('обновлено');expect(stats).toBe(2);expect(creatives).toBe(2);
});

test('chart instances survive updates, rendering is batched and unchanged creative cards keep their DOM',async({page})=>{
 await page.goto('/mvp'+portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await expect(page.locator('.platform-top-creatives')).toBeVisible();
 await page.evaluate(()=>{window.auditChart=Chart.getChart(document.getElementById('chart'));window.auditCreative=document.querySelector('.platform-top-creatives');window.auditUpdates=0;Chart.register({id:'render-regression',afterUpdate(){window.auditUpdates++;}});TOYS_NATIVE.render();TOYS_NATIVE.render();TOYS_NATIVE.render();});
 await expect.poll(()=>page.evaluate(()=>window.auditUpdates)).toBe(1);
 expect(await page.evaluate(()=>auditChart===Chart.getChart(document.getElementById('chart'))&&auditCreative===document.querySelector('.platform-top-creatives'))).toBe(true);
 await page.locator('#chartModeSeg [data-mode="efficiency"]').click();
 expect(await page.evaluate(()=>auditChart===Chart.getChart(document.getElementById('chart'))&&auditChart.options.animation===false)).toBe(true);
 await expect.poll(()=>page.evaluate(()=>auditChart.data.datasets.map(d=>d.label).join(','))).toContain('CTR');
});

test('large advertising hierarchy creates ad details only when their parent is opened',async({page})=>{
 let groupName='Lazy group';await page.clock.install();
 const observed=value=>({value:String(value),state:'observed'}),metrics={impressions:observed(100),clicks:observed(10),spend:observed(1000),conversions:observed(1)};
 await page.route('**/content-project/ads/hierarchy?*',r=>{const u=new URL(r.request().url()),date=u.searchParams.get('to'),dailyMetrics=[{date,metrics}];return r.fulfill({json:{ok:true,providers:[{provider:'meta_ads',integrationId:'test',freshness:'fresh',requestedRange:{from:u.searchParams.get('from'),to:date},hierarchy:{currency:'IDR',children:[{providerId:'campaign',name:'Lazy campaign',dailyMetrics,children:[{providerId:'group',name:groupName,dailyMetrics,children:Array.from({length:100},(_,i)=>({providerId:String(i),name:'Lazy ad '+i,dailyMetrics}))}]}]}}]}});});
 await page.goto('/mvp'+portal);await expect(page.locator('#platformNotice')).toContainText('обновлено');await page.locator('[data-ux-view="campaigns"]').click();
 await expect(page.locator('.platform-child')).toHaveCount(0);await page.locator('.platform-drilldown > summary').click();await expect(page.locator('.platform-child')).toHaveCount(1);
 await page.locator('.platform-child > summary').click();await expect(page.locator('.platform-child')).toHaveCount(101);await expect(page.locator('.platform-child .camp-metrics')).toHaveCount(1);
 await page.getByText('Lazy ad 0',{exact:true}).click();await expect(page.locator('.platform-child .camp-metrics')).toHaveCount(2);
 groupName='Updated group, unchanged campaign totals';await page.clock.fastForward(20*60*1000);await expect(page.locator('.platform-drilldown')).not.toHaveAttribute('open','');await page.locator('.platform-drilldown > summary').click();await expect(page.locator('.platform-child > summary')).toHaveText(groupName);
});

test('returning to Meta approvals and weekly reports reuses their screens without repeated reads',async({page})=>{
 const calls=[];page.on('request',r=>{if(r.method()==='GET'&&r.resourceType()==='fetch')calls.push(r.url());});
 await page.goto('/mvp'+portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 const meta=page.locator('#uxProjectChannels [data-channel="meta"],#uxProjectChannels [data-legacy-view="meta"]');
 await page.locator('[data-ux-view="project"]').click();await meta.click();await expect(page.locator('#creativeContent')).toContainText('ожидает подключения хранилища');
 const loaded=calls.filter(u=>u.endsWith('/content-project/creatives')).length;await page.locator('[data-ux-view="overview"]').click();await page.locator('[data-ux-view="project"]').click();await meta.click();await expect(page.locator('#creativeContent')).toContainText('ожидает подключения хранилища');expect(calls.filter(u=>u.endsWith('/content-project/creatives'))).toHaveLength(loaded);
 await page.locator('[data-ux-view="weekly"]').click();await expect(page.locator('#weeklyForm')).toBeVisible();await expect(page.locator('#commentsList')).not.toBeEmpty();
 const weeklyCalls=calls.filter(u=>/weekly-main|weekly-reports/.test(u)).length;await page.evaluate(()=>window.auditWeekly=document.getElementById('weeklyForm'));await page.locator('[data-ux-view="overview"]').click();await page.locator('[data-ux-view="weekly"]').click();await expect(page.locator('#weeklyForm')).toBeVisible();expect(await page.evaluate(()=>auditWeekly===document.getElementById('weeklyForm'))).toBe(true);expect(calls.filter(u=>/weekly-main|weekly-reports/.test(u))).toHaveLength(weeklyCalls);
});
