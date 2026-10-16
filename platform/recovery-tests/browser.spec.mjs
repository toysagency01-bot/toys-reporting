import {test,expect} from '@playwright/test';
import {rankCreatives} from '../native/top-creatives.js';
const portal='/api/v2/projects/housevip-cxp7/content-project';

async function mockCampaignBrowser(page){
 const state={calls:[],creativeCalls:0,groupName:'Lazy group',fail:false};
 const row=(id,level,name)=>({key:id.toString(16).padStart(64,'0'),level,name,provider:'meta_ads',currency:'IDR',status:'ACTIVE',childCount:level==='ad'?0:1,history:false,metrics:{impressions:100,clicks:10,ctr:10,spend:1000,conversions:2,cpa:500}});
 const campaign=row(1,'campaign','Lazy campaign');
 await page.route('**/campaign-browser?*',async r=>{const u=new URL(r.request().url());state.calls.push(u);if(state.holdFirst&&state.calls.length===1)await state.holdFirst;if(state.fail)return r.fulfill({status:503,json:{ok:false}});
 const parent=u.searchParams.get('parent'),offset=Number(u.searchParams.get('offset')||0),group=row(2,'group',state.groupName),all=parent===group.key?Array.from({length:105},(_,i)=>row(i+3,'ad','Lazy ad '+i)):parent===campaign.key?[group]:[campaign];
 return r.fulfill({json:{ok:true,rows:all.slice(offset,offset+50),total:all.length,nextOffset:offset+50<all.length?offset+50:null,parent:parent===campaign.key?campaign:parent===group.key?group:null,sources:[],refreshing:false}});
 });
 await page.route('**/campaign-browser/*/creative?*',r=>{state.creativeCalls++;return r.fulfill({json:{ok:true,creative:{bodies:['Полный текст объявления'],media:[]}}});});
 return state;
}


test('native password invitation opens CRM, signs out and signs back in',async({page})=>{
 await page.goto('/master/#access');await page.locator('#newClient').click();
 await page.locator('#accessForm [name=email]').fill('password-browser@example.test');await page.locator('#accessForm [name=projects]').first().check();
 await page.getByRole('button',{name:'Создать доступ',exact:true}).click();
 await expect(page.locator('#invitationText')).toHaveValue(/activate#token=/);
 const text=await page.locator('#invitationText').inputValue(),link=text.match(/https:\/\/[^\s]+\/activate#token=[a-f0-9]+/)[0];
 await page.setExtraHTTPHeaders({'x-test-public':'true'});
 await page.goto(link.replace('https://reports.toys-agency.com','http://127.0.0.1:4173'));
 await page.locator('[name=password]').fill('Test browser long password 123');await page.locator('[name=confirm]').fill('Test browser long password 123');
 await page.getByRole('button',{name:'Сохранить пароль и войти'}).click();await expect(page).toHaveURL(/\/housevip-cxp7\/(?:#overview)?$/);
 await page.locator('#platformCRMNav').click();await expect(page.locator('#platformClientCRM #newLead')).toBeVisible();
 await page.goto('/api/v2/portal/session?choose=1');await page.getByRole('link',{name:'Выйти из аккаунта'}).click();await expect(page).toHaveURL(/\/login$/);expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('toys-dashboard-cache:')).length)).toBe(0);expect(await page.evaluate(async()=>(await caches.keys()).filter(k=>k.startsWith('toys-dashboard-cache:')).length)).toBe(0);
 await page.locator('[name=email]').fill('password-browser@example.test');await page.locator('[name=password]').fill('Test browser long password 123');await page.getByRole('button',{name:'Войти',exact:true}).click();await expect(page).toHaveURL(/\/housevip-cxp7\/(?:#overview)?$/);
});

test('kanban moves persist, sales need an amount, search and mobile stay usable',async({page})=>{
 await page.goto('/api/v2/projects/housevip-cxp7/content-crm');await page.locator('#newLead').click();
 await page.locator('[name=name]').fill('Kanban test contact');await page.locator('[name=email]').fill('kanban@example.test');await page.getByRole('button',{name:'Добавить',exact:true}).click();
 const card=page.getByRole('button',{name:'Kanban test contact',exact:true}),column=status=>page.locator(`.kanban-column[data-stage="${status}"]`);
 await expect(column('Новый')).toContainText('Kanban test contact');await card.dragTo(column('В работе').locator('.stage-heading'));await expect(column('В работе')).toContainText('Kanban test contact');
 await page.reload();await expect(column('В работе')).toContainText('Kanban test contact');await card.dragTo(column('Продажа').locator('.stage-heading'));await expect(page.locator('#editor')).toBeVisible();await expect(page.locator('[name=status]')).toHaveValue('Продажа');
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(page.locator('#leadForm [role=status]')).toContainText('сумму');await expect(column('Продажа')).not.toContainText('Kanban test contact');
 await page.locator('[name=value]').fill('225');await page.locator('[name=currency]').fill('USD');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(column('Продажа')).toContainText('Kanban test contact');
 await page.locator('#search').fill('kanban@example.test');await expect(page.locator('#leadCount')).toHaveText('1');await expect(page.locator('.lead-card')).toHaveCount(1);
 await page.screenshot({path:'dist/crm-kanban-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#leadsBoard').evaluate(el=>el.scrollLeft=el.scrollWidth);await expect(card).toBeVisible();await card.click();await expect(page.locator('#leadForm')).toBeVisible();
});
test('dense kanban shows contacts, filters received dates and reaches final stages using visible navigation',async({page,request})=>{
 const api='/api/v2/projects/housevip-cxp7/crm';
 for(let i=0;i<30;i++){
  const r=await request.post(api,{headers:{'x-idempotency-key':'dense-lead-'+i,origin:'http://127.0.0.1:4173'},data:{name:'Dense contact '+i,phone:'+99555501'+String(i).padStart(4,'0'),email:'dense'+i+'@example.test'}});expect(r.ok(),await r.text()).toBe(true);
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto('/api/v2/projects/housevip-cxp7/content-crm');
 await expect(page.locator('#allDates')).toHaveClass('active');await expect(page.locator('#platformClientCRM #dateFrom')).toHaveValue('');await page.locator('#search').fill('Dense contact');
 await expect(page.locator('#leadCount')).toHaveText('30');await expect(page.locator('.lead-card')).toHaveCount(25);
 const column=page.locator('[data-stage="Новый"]'),cards=column.locator('.lead-card');
 expect(await column.locator('.stage-cards').evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
 expect(await cards.evaluateAll(cards=>cards.every(c=>{const r=c.getBoundingClientRect(),name=c.querySelector('strong').getBoundingClientRect(),phone=c.querySelector('.lead-phone').getBoundingClientRect();return r.height>110&&name.top>=r.top&&phone.bottom<=r.bottom;}))).toBe(true);
 await cards.last().scrollIntoViewIfNeeded();await expect(cards.last().locator('.lead-phone')).toBeInViewport();await column.getByRole('button',{name:/Показать ещё/}).click();await expect(page.locator('.lead-card')).toHaveCount(30);
 const slider=page.getByRole('slider',{name:'Прокрутка этапов'});await expect(slider).toBeVisible();await slider.focus();await slider.press('End');await expect(page.locator('[data-stage="Потерян"] .stage-heading')).toBeInViewport();await expect(page.locator('[data-stage="Не подходит"] .stage-heading')).toBeInViewport();
 await page.getByRole('button',{name:'Предыдущие этапы',exact:true}).click();await expect.poll(async()=>Number(await slider.inputValue())).toBeLessThan(1000);
 await slider.focus();await slider.press('Home');await expect(column.locator('.stage-heading')).toBeInViewport();await column.locator('.stage-cards').evaluate(e=>e.scrollTop=0);
 await page.getByRole('button',{name:'Сегодня',exact:true}).click();await expect(page.locator('#boardCaption')).toContainText('Поступили');await expect(page.locator('#leadCount')).toHaveText('30');
 await page.locator('#platformClientCRM #platformCalendar').click();await page.locator('[data-date="2026-10-01"]').click();await page.locator('[data-date="2026-10-02"]').click();await page.getByRole('button',{name:'Применить',exact:true}).click();await expect(page.locator('#leadCount')).toHaveText('0');await expect(page.locator('#boardCaption')).toContainText('01.10.2026 — 02.10.2026');
 await page.locator('#allDates').click();await expect(page.locator('#leadCount')).toHaveText('30');await expect(page.locator('#platformClientCRM #platformCalendar')).toHaveText('Выбрать период');
 await page.locator('#theme').click();await page.screenshot({path:'dist/crm-dense-1440.png',fullPage:true});
 await page.setViewportSize({width:1920,height:1080});
 expect(await page.locator('#leadsBoard').evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=1690&&r.right>innerWidth-24;})).toBe(true);await expect(page.locator('[data-stage="Потерян"] .stage-heading')).toBeInViewport();
 await page.screenshot({path:'dist/crm-wide-1920.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await slider.focus();await slider.press('End');await expect(page.locator('[data-stage="Потерян"] .stage-heading')).toBeInViewport();
});

test('kanban counters update for current statuses and sale edits and persist separate master date ranges',async({page})=>{
 await page.goto('/master/#crm');await page.locator('#newLead').click();await page.locator('[name=name]').fill('Current metrics contact');await page.locator('[name=phone]').fill('+995555019999');await page.getByRole('button',{name:'Добавить',exact:true}).click();
 await expect(page.locator('#editor')).not.toBeVisible();
 await page.locator('#search').fill('Current metrics contact');await expect(page.locator('#leadCount')).toHaveText('1');
 const card=page.getByRole('button',{name:'Current metrics contact',exact:true}),metric=label=>page.locator('#crmSummary .card').filter({has:page.locator('.label',{hasText:label})}).locator('.value');
 const save=()=>page.getByRole('button',{name:'Сохранить',exact:true}).click();
 await card.click();await page.locator('[name=status]').selectOption('Квалифицирован');await save();await expect(metric('Квалифицированы')).toHaveText('1');await expect(metric('Продажи')).toHaveText('0');
 await card.click();await page.locator('[name=status]').selectOption('Продажа');await page.locator('[name=value]').fill('325');await page.locator('[name=currency]').fill('EUR');await save();await expect(metric('Квалифицированы')).toHaveText('0');await expect(metric('Продажи')).toHaveText('1');await expect(metric('Выручка CRM')).toHaveText('325 EUR');
 await card.click();await expect(page.locator('[name=value]')).toHaveValue('325');await page.locator('[name=value]').fill('450');await save();await expect(metric('Выручка CRM')).toHaveText('450 EUR');
 await card.click();await page.locator('[name=status]').selectOption('Потерян');await save();await expect(metric('Продажи')).toHaveText('0');await expect(metric('Выручка CRM')).toHaveText('0');
 await page.locator('#periodSeg [data-days="30"]').click();const from=await page.locator('#dateFrom').inputValue();await page.locator('[data-view=home]').click();await expect(page.locator('#allDates')).toBeHidden();await expect(page.locator('#periodSeg [data-days="7"]')).toHaveClass('active');await page.locator('[data-view=crm]').click();await expect(page.locator('#dateFrom')).toHaveValue(from);await expect(page.locator('#periodSeg [data-days="30"]')).toHaveClass('active');
 await page.reload();await page.locator('#search').fill('Current metrics contact');await expect(page.locator('#leadCount')).toHaveText('1');await expect(metric('Продажи')).toHaveText('0');await expect(metric('Выручка CRM')).toHaveText('0');
});
test('TOYS login is self-contained, branded and usable on mobile',async({page})=>{
 const requests=[],errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:960});await page.goto('/login');await page.evaluate(()=>document.fonts.ready);
 await expect(page.getByRole('heading',{level:1})).toHaveText('Платформа для клиентов TOYS.');await expect(page.locator('.brand-description')).toHaveText('Наслаждайтесь менеджментом маркетинговых процессов нового поколения в all-in экосистеме');
 await expect(page.getByRole('button',{name:'Войти',exact:true})).toHaveAttribute('type','submit');
 expect(await page.evaluate(()=>document.fonts.check('600 40px "Golos Text"','Платформа'))).toBe(true);
 await page.screenshot({path:'dist/login-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'Войти',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Войти',exact:true})).toBeVisible();await page.screenshot({path:'dist/login-mobile.png',fullPage:true});
 expect(requests.filter(u=>!u.endsWith('/login'))).toEqual([]);expect(errors).toEqual([]);
});
test('master creates a client invitation, preserves assignments and disables access',async({page})=>{
 await page.goto('/master/#access');await expect(page.getByRole('heading',{name:'Доступы',exact:true})).toBeVisible();await page.getByRole('button',{name:'Добавить пользователя',exact:true}).click();
 await page.locator('#accessForm [name=name]').fill('Тест клиента');await page.locator('#accessForm [name=email]').fill('browser-client@example.test');await page.locator('#accessForm [name=projects]').first().check();await page.getByRole('button',{name:'Создать доступ',exact:true}).click();await expect(page.locator('#accessFormStatus')).toHaveText('Доступ сохранён.');expect(await page.locator('#invitationText').inputValue()).toContain('browser-client@example.test');
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.reload();const row=page.locator('#accessUsers tr').filter({hasText:'browser-client@example.test'});await expect(row).toContainText('HOUSEVIP');await expect(row).toContainText('Ожидает первого входа');await row.getByRole('button',{name:'Настроить'}).click();await page.locator('#accessForm [name=enabled]').uncheck();await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(page.locator('#accessFormStatus')).toContainText('Доступ отключён');await expect(page.locator('#accessInvitation')).toBeHidden();await page.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(row).toContainText('Доступ отключён');
});
test('client viewer gets published weekly reports and an account link without agency editors',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-viewer':'true'});await page.goto(portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await page.locator('[data-ux-view="weekly"]').click();await expect(page.locator('#weeklyContent')).not.toContainText('Для этого действия войдите');await expect(page.locator('#weeklyForm')).toHaveCount(0);await expect(page.locator('#platformAccountNav')).toHaveAttribute('href','/api/v2/portal/session?choose=1');await page.locator('#platformCRMNav').click();await expect(page.locator('#platformClientCRM #newLead')).toBeVisible();await expect(page.locator('#platformClientCRM #accessNav')).toBeHidden();
});
test('mounted portal renders Golos with the generic asset route unavailable',async({page})=>{
 // Match the dated advertising fixture; keep CRM tests on the server's current day.
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.goto(portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await expectGolos(page);
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
test('BSCLINIC keeps lead metrics and resolves material tabs by explicit channel without Google or Sheets',async({page,request})=>{
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 const data=await(await request.get('/api/v2/projects/housevip-cxp7/dashboard')).json();
 data.dashboard.project.slug='bs-clinic-a5b4';data.dashboard.project.name='BSCLINIC';
 // This project starts on the latest seven days, independently of the fixed
 // HOUSEVIP historical fixture used by the remaining scenarios.
 for(const row of data.dashboard.facts.rows)row.date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 for(const row of data.dashboard.facts.rows)for(const m of row.metrics)if(m.currency)m.currency='CZK';
 const api='**/projects/bs-clinic-a5b4/';
 await page.route(api+'dashboard',r=>r.fulfill({json:data}));
 await page.route(api+'weekly-reports',r=>r.fulfill({json:{ok:true,reports:[]}}));
 await page.route(api+'content/tabs',r=>r.fulfill({json:{ok:true,tabs:[{channel:'meta',sourceTitle:'BSCLINIC - Сводка',label:'Сводка (неделя)',mode:'table'},{channel:'smm',sourceTitle:'09.26',label:'Отчёт 09.26',mode:'table'}]}}));
 await page.route(api+'content/tabs?*',r=>r.fulfill({json:{status:'ok',table:{cols:[{label:''}],rows:[{c:[{v:'Раздел'}]},{c:[{v:'Материалы выбранного канала'}]}]}}}));
 await page.goto('/bs-clinic-a5b4/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await expectGolos(page);
 await expect(page.locator('#mainCards')).toContainText('Лиды');
 await expect(page.locator('.platform-top-creatives')).toHaveCount(1);
 await page.locator('#uxNav [data-ux-view="project"]').click();
 await page.getByRole('button',{name:'Meta',exact:true}).click();await expect(page.getByRole('button',{name:'Сводка (неделя)',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Сводка (неделя)',exact:true}).click();await expect(page.locator('#genericSection')).toContainText('Материалы выбранного канала');
 await page.getByRole('button',{name:'SMM',exact:true}).click();await expect(page.getByRole('button',{name:'Отчёт 09.26',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Google',exact:true})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(requests.some(u=>/docs.google|sheets.googleapis/.test(u))).toBe(false);expect(errors).toEqual([]);
});
test('dashboard and durable weekly workflow',async({page})=>{
 // Match the dated advertising fixture; keep CRM tests on the server's current day.
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await expectGolos(page);
 await expect(page.locator('#dateFrom')).toHaveCount(1);
 await page.screenshot({path:'dist/desktop.png',fullPage:true,animations:'disabled'});
 await page.locator('[data-ux-view="project"]').click();await page.locator('#uxProjectChannels [data-channel="meta"],#uxProjectChannels [data-legacy-view="meta"]').first().click();await expect(page.locator('#projectView')).toContainText('Подготовить новые креативы');
 await page.locator('[data-ux-view="weekly"]').click();await page.locator('#uxWeeklyAdd').click();await expect(page.locator('#weeklyForm')).toBeVisible();
 await page.locator('[name="channel"]').selectOption('meta');
 await page.locator('[name="summary"]').fill('Проверка сохранения из браузера');
 await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click();
 await expect(page.locator('#weeklyMessage')).toContainText('Черновик сохранён');
 await page.reload();await page.locator('#uxWeeklyAdd').click();await expect(page.locator('[name="summary"]')).toHaveValue('Проверка сохранения из браузера');
 await page.getByRole('button',{name:'Сохранить и опубликовать',exact:true}).click();
 await expect(page.locator('#weeklyMessage')).toContainText('Отчёт опубликован');
 await expect(page.locator('#weeklyForm')).toHaveCount(0);await page.locator('[data-weekly-published] summary').click();await page.getByRole('button',{name:'Редактировать',exact:true}).click();
 await page.locator('#commentForm textarea').fill('Комментарий из браузера');await page.getByRole('button',{name:'Добавить комментарий',exact:true}).click();
 await expect(page.locator('#commentsList')).toContainText('Комментарий из браузера');
 await page.getByRole('button',{name:'История',exact:true}).click();await expect(page.locator('#historyContent')).toContainText('Версия');await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await page.locator('[data-ux-view="project"]').click();await page.locator('#uxProjectChannels [data-legacy-view="meta"],#uxProjectChannels [data-channel="meta"]').first().click();await expect(page.locator('#creativeContent')).toContainText('ожидает подключения хранилища');
 expect(errors).toEqual([]);
});
test('mobile navigation stays within viewport',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto(portal);await expect(page.locator('#mainCards')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'dist/mobile.png',fullPage:true,animations:'disabled'});});
test('native cards refresh once, expose groups and retain usable data after a failed refresh',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let calls=0;await mockCampaignBrowser(page);
 const observed=value=>({value:String(value),state:'observed'});
 await page.route('**/content-project/ads/hierarchy?*',async route=>{
  const url=new URL(route.request().url());calls++;
  const metrics={impressions:observed(120),clicks:observed(9),spend:observed(100),conversions:{value:null,state:'unsupported'}};
  await route.fulfill({json:{ok:true,providers:[{provider:'meta_ads',integrationId:'test',freshness:'fresh',requestedRange:{from:url.searchParams.get('from'),to:url.searchParams.get('to')},hierarchy:calls===1?{currency:'IDR',children:[{providerId:'live',name:'Обновлённая кампания',dailyMetrics:[{date:'2026-10-07',metrics}],children:[{providerId:'group',name:'Группа объявлений',dailyMetrics:[{date:'2026-10-07',metrics}]}]}]}:null}]}});
 });
 await page.clock.install({time:new Date('2026-10-14T06:07:00Z')});await page.goto(portal);await expect(page.locator('#platformNotice')).toContainText('обновлено');
 await expect(page.locator('#kClicks')).toHaveText('9');await expect(page.locator('#kConv')).toHaveText('—');
 await page.locator('#uxNav [data-ux-view="campaigns"]').click();await expect(page.locator('#campList')).toContainText('Обновлённая кампания');
 await page.getByRole('button',{name:'Открыть группы: Lazy campaign'}).click();await expect(page.locator('#platformCampaignBrowser')).toContainText('Lazy group');
 await page.clock.fastForward(20*60*1000);await expect(page.locator('#platformNotice')).toContainText('подключение не завершено');
 await expect(page.locator('#kClicks')).toHaveText('9');expect(errors).toEqual([]);
});
for(const slug of ['karlovarska-sul-k4rm','profkit-instashop-r4vk'])test(slug+' retains original board sections and icons',async({page,request})=>{
 // Match the dated advertising fixture; keep CRM tests on the server's current day.
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const d=await(await request.get('/api/v2/projects/housevip-cxp7/dashboard')).json();const original=d.dashboard.facts.rows[0];
 const observed=(metricCode,value,currency=null)=>({metricCode,value:String(value),state:'observed',currency});
 d.dashboard.project.slug=slug;d.dashboard.project.name=slug==='karlovarska-sul-k4rm'?'Karlovarska Sul':'PROFKIT';
 if(slug.startsWith('karl')){d.dashboard.advertising={channels:{meta:d.dashboard.facts,google:d.dashboard.facts}};const rows=[{date:original.date,platform:'Meta Ads',metrics:[observed('ecom.purchases',2),observed('ecom.purchase_value',200,'EUR'),observed('ecom.add_to_cart',5),observed('ecom.checkout',3)]}];rows.push({...rows[0],platform:'Google Ads'});d.dashboard.ecommerce={account:{rows},campaigns:{rows:rows.map(r=>({...r,campaign:{label:'Тестовая кампания'}}))}};}
 else{d.dashboard.instashop={ads:{rows:[{...original,metrics:[observed('ads.spend_uah',410,'UAH'),observed('ads.raw_spend_usd',10,'USD'),observed('ads.impressions',1000),observed('ads.clicks',25),observed('instashop.meta_direct',4)]}]},sales:{rows:[{date:original.date,metrics:[observed('instashop.sales_count',2),observed('instashop.revenue_uah',1000,'UAH'),observed('instashop.direct_inquiries',10),observed('instashop.qualified_inquiries',8),observed('instashop.unqualified_inquiries',2)]}]}};}
 await page.route('**/projects/'+slug+'/dashboard*',r=>r.fulfill({json:d}));
 await page.route('**/projects/'+slug+'/content/tabs',r=>r.fulfill({json:{ok:true,tabs:[]}}));
 await page.route('**/projects/'+slug+'/weekly-reports',r=>r.fulfill({json:{ok:true,reports:[]}}));
 await page.goto('/'+slug+'/#section=overview&view=account');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
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
 // Match the dated advertising fixture; keep CRM tests on the server's current day.
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 const observed=value=>({value:String(value),state:'observed'});
 await page.route('**/top-creatives?*',route=>{const u=new URL(route.request().url());const requestedRange={from:u.searchParams.get('from'),to:u.searchParams.get('to')};const date=requestedRange.from;const metrics={impressions:observed(100),clicks:observed(12),spend:observed(10),conversions:{value:null,state:'unsupported'}};
 const ads=[['Лучший по лидам',10,1,20],['Лучший по продажам',1,8,30],['Лучший по ROAS',2,2,100]].map(([name,leads,purchases,purchaseValue],i)=>({level:'ad',providerId:String(i),name,dailyMetrics:[{date,metrics}],outcomeDaily:[{date,metrics:{leads:observed(leads),purchases:observed(purchases),purchaseValue:observed(purchaseValue)}}]}));
 const providers=[{provider:'meta_ads',integrationId:'test',freshness:'fresh',requestedRange,hierarchy:{currency:'IDR',children:[{providerId:'campaign',name:'Кампания',dailyMetrics:[{date,metrics}],children:[{children:ads}]}]}}];return route.fulfill({json:{ok:true,rankings:Object.fromEntries(['roas','purchases','leads','qualifiedLeads'].map(b=>[b,rankCreatives(providers,requestedRange,b)]))}});});
 await page.goto(portal);await expect(page.locator('.top-creative')).toHaveCount(3);await expect(page.locator('.top-creative h3').first()).toHaveText('Лучший по лидам');await page.locator('[data-ranking="roas"]').click();await expect(page.locator('.top-creative h3').first()).toHaveText('Лучший по ROAS');await page.locator('[data-ranking="purchases"]').click();await expect(page.locator('.top-creative h3').first()).toHaveText('Лучший по продажам');await page.locator('[data-ranking="qualifiedLeads"]').click();await expect(page.locator('.top-creative')).toHaveCount(0);
});

test('public short board requests creative rankings without requesting private hierarchy',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-public':'true'});const seen=[];page.on('request',r=>seen.push(r.url()));
 await page.route('**/top-creatives?*',r=>r.fulfill({json:{ok:true,rankings:{leads:[{provider:'meta_ads',rows:[{name:'Публичный креатив',score:4,ctr:2,spend:100,currency:'IDR',freshness:'fresh'}]}]}}}));
 await page.goto('/housevip-cxp7/#overview');await expect(page.locator('.top-creative h3')).toHaveText('Публичный креатив');expect(seen.some(u=>u.includes('/top-creatives?'))).toBe(true);expect(seen.some(u=>u.includes('/ads/hierarchy'))).toBe(false);
});
test('dashboard shell is visible while data is pending, without an entry loading screen',async({page})=>{
 // Match the dated advertising fixture; keep CRM tests on the server's current day.
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 let release;const gate=new Promise(resolve=>release=resolve);await page.route('**/dashboard',async route=>{await gate;await route.continue();});
 await page.goto('/housevip-cxp7/#overview',{waitUntil:'domcontentloaded'});
 await expect(page.locator('header')).toBeVisible();await expect(page.locator('#uxNav')).toBeVisible();await expect(page.locator('#uxOverview')).toBeVisible();await expect(page.locator('#mainCards')).toBeVisible();await expect(page.getByText('Загружаю данные…',{exact:true})).not.toBeVisible();
 await expect(page.locator('body')).toHaveAttribute('data-platform-loading','true');release();await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await expect(page.locator('#kClicks')).toHaveText('25');
});

test('Today in the public board loads current-day advertising instead of stopping at the snapshot',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-public':'true'});
 await page.route('**/ads-summary?*',route=>{const u=new URL(route.request().url()),range={from:u.searchParams.get('from'),to:u.searchParams.get('to')};const m=v=>({value:String(v),state:'observed'});return route.fulfill({json:{ok:true,providers:[{provider:'meta_ads',freshness:'fresh',requestedRange:range,hierarchy:{currency:'IDR',children:[{providerId:'today',name:'Сегодня',dailyMetrics:[{date:range.from,metrics:{impressions:m(200),clicks:m(17),spend:m(900),conversions:m(3)}}]}]}}]}});});
 await page.goto('/housevip-cxp7/#overview');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await page.getByRole('button',{name:'Сегодня',exact:true}).click();await expect(page.locator('#kClicks')).toHaveText('17');await expect(page.locator('#content')).toBeVisible();await expect(page.locator('#emptyState')).not.toBeVisible();
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
 await page.goto('/master/');await expect(page.locator('#projectSelect')).toContainText('HOUSEVIP');
 await expect(page.locator('.master-sidebar')).toBeVisible();await expect(page.locator('#home')).toBeVisible();await expect(page.locator('#crm')).toBeHidden();
 await page.locator('[data-view="crm"]').click();await expect(page.locator('#crm')).toBeVisible();await expect(page.locator('#home')).toBeHidden();
 await page.locator('#newLead').click();await page.locator('[name="name"]').fill('Synthetic CRM Browser');await page.locator('[name="email"]').fill('crm-browser@example.test');await page.getByRole('button',{name:'Добавить',exact:true}).click();
 await expect(page.locator('#leadsBoard')).toContainText('Synthetic CRM Browser');await page.getByRole('button',{name:'Synthetic CRM Browser',exact:true}).click();await page.locator('[name="status"]').selectOption('Квалифицирован');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(page.locator('#crmSummary')).toContainText('1');
 await page.reload();await expect(page.locator('#leadsBoard')).toContainText('Квалифицирован');await page.getByRole('button',{name:'Synthetic CRM Browser',exact:true}).click();await page.locator('[name="status"]').selectOption('Продажа');await page.locator('[name="value"]').fill('150');await page.locator('[name="currency"]').fill('EUR');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(page.locator('#crmSummary')).toContainText('150 EUR');
 await page.screenshot({path:'dist/master-crm.png',fullPage:true,animations:'disabled'});await page.locator('#theme').click();await expect(page.locator('#brandLogo')).toHaveAttribute('src',/toys-black/);expect(errors).toEqual([]);
});

test('client keeps Home and CRM mounted, caches leads and preserves period and filters without document reloads',async({page})=>{
 const calls=[],documents=[],urls=[];page.on('request',r=>{calls.push(new URL(r.url()).pathname);urls.push(r.url());if(r.isNavigationRequest())documents.push(r.url());});
 await page.goto(portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 const marker=await page.evaluate(()=>window.navigationTestMarker=crypto.randomUUID());const period=await page.locator('body > :not(#platformClientCRM) #dateFrom').inputValue();
 await page.locator('#platformCRMNav').click();await expect(page.locator('#heading')).toHaveText('CRM');
 await expect(page.locator('#projectSelect')).toBeHidden();await expect(page.locator('#connections')).toBeHidden();
 await expect(page.locator('#leadsBoard')).not.toBeEmpty();expect(calls.some(p=>p.includes('/master'))).toBe(false);
 await page.locator('#statusFilter').selectOption('Квалифицирован');await expect(page.locator('#leadsBoard')).not.toBeEmpty();
 // Wait for the new filter request, then ensure a quick round trip uses memory.
 await expect.poll(()=>calls.filter(p=>p.endsWith('/crm')).length).toBe(2);await page.waitForTimeout(100);
 const requests=calls.length;
 await page.getByRole('link',{name:'Главная',exact:true}).click();await expect(page).toHaveURL(/\/housevip-cxp7\/(?:#overview)?$/);
 await expect(page.locator('body > :not(#platformClientCRM) #dateFrom')).toHaveValue(period);
 await page.locator('#platformCRMNav').click();await expect(page.locator('#statusFilter')).toHaveValue('Квалифицирован');await expect(page.locator('#leadsBoard')).not.toBeEmpty();
 expect(await page.evaluate(()=>window.navigationTestMarker)).toBe(marker);expect(documents).toHaveLength(1);expect(urls.slice(requests)).toEqual([]);
 await page.goBack();await expect(page.locator('#platformClientCRM')).toBeHidden();await page.goForward();await expect(page.locator('#platformClientCRM')).toBeVisible();expect(documents).toHaveLength(1);
 await page.screenshot({path:'dist/client-crm-cached.png',fullPage:true,animations:'disabled'});
 await page.locator('#platformClientCRM #theme').click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.getByRole('link',{name:'Главная',exact:true}).click();await expect(page.locator('header img[alt="TOYS"]')).toHaveAttribute('src',/toys-black/);
 await page.locator('#platformCRMNav').click();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('HOUSEVIP Leads button and old lead hashes open CRM without falling back to the project plan',async({page})=>{
 const documents=[];page.on('request',r=>{if(r.isNavigationRequest())documents.push(r.url());});
 await page.setExtraHTTPHeaders({'x-test-viewer':'true'});await page.goto('/housevip-cxp7/#overview');
 await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await expect(page.locator('[data-ux-view="leads"]')).toBeVisible();await page.locator('[data-ux-view="leads"]').click();
 await expect(page.locator('#platformClientCRM')).toBeVisible();await expect(page.locator('#heading')).toHaveText('CRM');
 await expect(page).toHaveURL(/\/content-crm$/);expect(documents).toHaveLength(1);
 for(const hash of ['#leads','#meta/'+encodeURIComponent('ЛИДЫ')]){
  await page.goto('/housevip-cxp7/'+hash);await expect(page.locator('#platformClientCRM')).toBeVisible();
  await expect(page).toHaveURL(/\/content-crm$/);await expect(page.locator('#heading')).toHaveText('CRM');
 }
});

test('direct client CRM link opens the unified screen, writes invalidate lead cache and update the board',async({page})=>{
 await page.goto('/api/v2/projects/housevip-cxp7/content-crm');await expect(page.locator('#heading')).toHaveText('CRM');await expect(page.locator('#leadsBoard')).not.toBeEmpty();
 await page.locator('#newLead').click();await page.locator('[name="name"]').fill('Cache invalidation lead');await page.locator('[name="email"]').fill('cache@example.test');await page.getByRole('button',{name:'Добавить',exact:true}).click();
 await expect(page.locator('#leadsBoard')).toContainText('Cache invalidation lead');await page.getByRole('button',{name:'Cache invalidation lead',exact:true}).click();await page.locator('[name="status"]').selectOption('Квалифицирован');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(page.locator('#leadsBoard')).toContainText('Квалифицирован');
 await page.getByRole('link',{name:'Главная',exact:true}).click();await expect(page.locator('#platformCRMStats')).toContainText('Квал-лиды CRM');await page.locator('#platformCRMNav').click();await expect(page.locator('#leadsBoard')).toContainText('Cache invalidation lead');
});

test('agency connection settings explain Make intake and do not require the direct Meta webhook',async({page})=>{
 await page.goto('/api/v2/master/view#crm');
 await page.locator('#connections').click();
 await expect(page.locator('#makeConnection')).toContainText('Meta Lead Ads через Make');
 await expect(page.locator('#makeConnection')).toContainText('/housevip-cxp7/meta-lead');
 await expect(page.locator('#makeConnection')).toContainText('Credentials');
 await expect(page.locator('#websiteKey')).toBeVisible();
 await expect(page.locator('#pageList')).toBeVisible();
 await expect(page.getByText('Только для прямого подключения:',{exact:false})).toBeHidden();
});

test('pending imports are cached without rapid polling and update at the next scheduled slot',async({page})=>{
 let stats=0,creatives=0;
 await page.setExtraHTTPHeaders({'x-test-public':'true'});
 await page.route('**/ads-summary?*',route=>{const u=new URL(route.request().url()),range={from:u.searchParams.get('from'),to:u.searchParams.get('to')};const pending=++stats===1,m=v=>({value:String(v),state:'observed'});return route.fulfill({json:{ok:true,refreshing:pending,providers:[{provider:'meta_ads',freshness:pending?'refreshing':'fresh',requestedRange:range,hierarchy:pending?null:{currency:'IDR',children:[{providerId:'live',name:'Updated',dailyMetrics:[{date:range.to,metrics:{impressions:m(200),clicks:m(88),spend:m(900),conversions:m(3)}}]}]}}]}});});
 await page.route('**/top-creatives?*',route=>{const pending=++creatives===1;return route.fulfill({json:{ok:true,refreshing:pending,rankings:{leads:[{provider:'meta_ads',rows:pending?[]:[{name:'Automatically refreshed creative',score:4,ctr:2,spend:100,currency:'IDR',freshness:'fresh'}]}]}}});});
 await page.clock.install({time:new Date('2026-10-14T06:03:00Z')});await page.goto('/housevip-cxp7/');
 await expect(page.locator('#platformNotice')).toContainText('Импорт по расписанию');
 await page.clock.fastForward(10*60000);expect(stats).toBe(1);expect(creatives).toBe(1);
 await page.reload();await expect(page.locator('#platformNotice')).toContainText('Импорт по расписанию');expect(stats).toBe(1);expect(creatives).toBe(1);
 await page.clock.fastForward(9*60000);await expect(page.locator('#kClicks')).toHaveText('88');await expect(page.locator('.top-creative h3')).toHaveText('Automatically refreshed creative');await expect(page.locator('#platformNotice')).toContainText('обновлено');expect(stats).toBe(2);expect(creatives).toBe(2);
});

test('open dashboard refreshes hourly at night and resumes daytime cadence using Tbilisi time',async({page})=>{
 let reads=0;
 await page.setExtraHTTPHeaders({'x-test-public':'true'});
 await page.clock.install({time:new Date('2026-10-12T20:03:00Z')});
 await page.route('**/ads-summary?*',route=>{reads++;return route.fulfill({json:{ok:true,refreshing:false,providers:[]}});});
 await page.route('**/top-creatives?*',route=>route.fulfill({json:{ok:true,refreshing:false,rankings:{leads:[]}}}));
 await page.goto('/housevip-cxp7/');
 await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await expect.poll(()=>reads).toBe(1);
 await page.clock.fastForward(37*60000); // 00:40 Tbilisi
 expect(reads).toBe(1);
 await page.clock.fastForward(22*60000); // 01:02 Tbilisi
 await expect.poll(()=>reads).toBe(2);
 await page.clock.fastForward(8*60*60000); // 09:02 Tbilisi, waking a suspended tab
 await expect.poll(()=>reads).toBe(3);
 await page.clock.fastForward(20*60000);
 await expect.poll(()=>reads).toBe(4);
});

test('chart instances survive updates, rendering is batched and unchanged creative cards keep their DOM',async({page})=>{
 // Match the dated advertising fixture; keep CRM tests on the server's current day.
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 await page.goto(portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await expect(page.locator('.platform-top-creatives')).toBeVisible();
 await expect(page.locator('.top-basis')).toBeVisible();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.evaluate(()=>{window.auditChart=Chart.getChart(document.getElementById('chart'));window.auditCreative=document.querySelector('.platform-top-creatives');window.auditUpdates=0;Chart.register({id:'render-regression',afterUpdate(){window.auditUpdates++;}});TOYS_NATIVE.render();TOYS_NATIVE.render();TOYS_NATIVE.render();});
 await expect.poll(()=>page.evaluate(()=>window.auditUpdates)).toBe(1);
 expect(await page.evaluate(()=>auditChart===Chart.getChart(document.getElementById('chart'))&&auditCreative===document.querySelector('.platform-top-creatives'))).toBe(true);
 await page.locator('#chartModeSeg [data-mode="efficiency"]').click();
 expect(await page.evaluate(()=>auditChart===Chart.getChart(document.getElementById('chart'))&&auditChart.options.animation===false)).toBe(true);
 await expect.poll(()=>page.evaluate(()=>auditChart.data.datasets.map(d=>d.label).join(','))).toContain('CTR');
});

test('campaign hierarchy fetches and renders only opened levels, paginates ads and refreshes expanded rows',async({page})=>{
 await page.clock.install({time:new Date('2026-10-14T06:07:00Z')});const fixture=await mockCampaignBrowser(page);
 await page.goto(portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');expect(fixture.calls.length).toBe(0);
 await page.locator('[data-ux-view="campaigns"]').click();await expect(page.locator('.campaign-entity')).toHaveCount(1);expect(fixture.calls.length).toBe(1);
 await page.getByRole('button',{name:'Открыть группы: Lazy campaign'}).click();await expect(page.locator('.campaign-entity')).toHaveCount(2);expect(fixture.calls.length).toBe(2);
 await page.getByRole('button',{name:'Открыть объявления: Lazy group'}).click();await expect(page.locator('.campaign-entity')).toHaveCount(52);
 await page.getByRole('button',{name:'Показать ещё · 50 из 105'}).click();await expect(page.locator('.campaign-entity')).toHaveCount(102);
 await page.getByRole('button',{name:'Открыть объявления: Lazy group'}).click();await expect(page.locator('.campaign-entity')).toHaveCount(2);
 await page.getByRole('button',{name:'Открыть объявления: Lazy group'}).click();await expect(page.locator('.campaign-entity')).toHaveCount(102);expect(fixture.calls.length).toBe(4);
 await page.getByRole('button',{name:'Открыть объявление: Lazy ad 0',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Полный текст объявления');await page.keyboard.press('Escape');expect(fixture.creativeCalls).toBe(1);
 await page.screenshot({path:'dist/campaign-hierarchy-desktop.png'});
 fixture.groupName='Updated group';await page.clock.fastForward(20*60*1000);await expect(page.getByRole('button',{name:'Открыть объявления: Updated group'})).toBeVisible();await expect(page.locator('.campaign-entity')).toHaveCount(52);
 fixture.fail=true;await page.clock.fastForward(20*60*1000);await expect(page.locator('.campaign-state[role=alert]').first()).toContainText('Не удалось загрузить');await expect(page.locator('.campaign-entity')).toHaveCount(52);
 fixture.fail=false;await page.locator('.campaign-state[role=alert] button').first().click();await expect(page.locator('.campaign-list > .campaign-state[role=alert]')).toHaveCount(0);await expect(page.locator('.campaign-entity')).toHaveCount(52);
});

test('mobile campaigns use breadcrumbs, cached drill-in and preserve viewport and bottom navigation',async({page})=>{
 // Match the dated advertising fixture; keep CRM tests on the server's current day.
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 await page.setViewportSize({width:390,height:844});const fixture=await mockCampaignBrowser(page);
 await page.goto(portal);await page.locator('[data-ux-view="campaigns"]').click();await expect(page.locator('.campaign-entity')).toHaveCount(1);
 await page.getByRole('button',{name:'Открыть группы: Lazy campaign'}).click();await expect(page.locator('.campaign-entity')).toHaveCount(1);await expect(page.locator('.campaign-breadcrumbs')).toContainText('Lazy campaign');
 await page.getByRole('button',{name:'Открыть объявления: Lazy group'}).click();await expect(page.locator('.campaign-entity')).toHaveCount(50);await expect(page.locator('.campaign-breadcrumbs')).toContainText('Lazy group');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('#platformCRMNav')).toBeVisible();
 await page.screenshot({path:'dist/campaign-hierarchy-mobile.png'});
 await page.locator('.campaign-breadcrumbs').getByRole('button',{name:'Lazy campaign',exact:true}).click();await expect(page.locator('.campaign-entity')).toHaveCount(1);await page.getByRole('button',{name:'Открыть объявления: Lazy group'}).click();await expect(page.locator('.campaign-entity')).toHaveCount(50);expect(fixture.calls.length).toBe(3);
 await page.getByRole('button',{name:'Сегодня',exact:true}).click();await expect(page.locator('.campaign-breadcrumbs')).not.toContainText('Lazy group');await expect.poll(()=>fixture.calls.length).toBe(4);
});

test('changing periods shares pending campaign reads when returning to the previous period',async({page})=>{
 // Match the dated advertising fixture; keep CRM tests on the server's current day.
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 const fixture=await mockCampaignBrowser(page);let release;fixture.holdFirst=new Promise(resolve=>release=resolve);
 try{
  await page.goto(portal);await page.locator('[data-ux-view="campaigns"]').click();await expect.poll(()=>fixture.calls.length).toBe(1);
  await page.getByRole('button',{name:'Сегодня',exact:true}).click();await expect.poll(()=>fixture.calls.length).toBe(2);await expect(page.locator('.campaign-entity')).toHaveCount(1);
  await page.getByRole('button',{name:'7 дней',exact:true}).click();release();await expect(page.locator('.campaign-entity')).toHaveCount(1);expect(fixture.calls.length).toBe(2);
  await page.reload();await expect(page.locator('.campaign-entity')).toHaveCount(1);expect(fixture.calls.length).toBe(2);
 }finally{release();}
});

test('returning to Meta approvals and weekly reports reuses their screens without repeated reads',async({page})=>{
 // Match the dated advertising fixture; keep CRM tests on the server's current day.
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 const calls=[];page.on('request',r=>{if(r.method()==='GET'&&r.resourceType()==='fetch')calls.push(r.url());});
 await page.goto(portal);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 const meta=page.locator('#uxProjectChannels [data-channel="meta"],#uxProjectChannels [data-legacy-view="meta"]');
 await page.locator('[data-ux-view="project"]').click();await meta.click();await expect(page.locator('#creativeContent')).toContainText('ожидает подключения хранилища');
 const loaded=calls.filter(u=>u.endsWith('/content-project/creatives')).length;await page.locator('[data-ux-view="overview"]').click();await page.locator('[data-ux-view="project"]').click();await meta.click();await expect(page.locator('#creativeContent')).toContainText('ожидает подключения хранилища');expect(calls.filter(u=>u.endsWith('/content-project/creatives'))).toHaveLength(loaded);
 await page.locator('[data-ux-view="weekly"]').click();await page.locator('#uxWeeklyAdd').click();await expect(page.locator('#weeklyForm')).toBeVisible();await expect(page.locator('#commentsList')).not.toBeEmpty();
 const weeklyCalls=calls.filter(u=>/weekly-main|weekly-reports/.test(u)).length;await page.evaluate(()=>window.auditWeekly=document.getElementById('weeklyForm'));await page.locator('[data-ux-view="overview"]').click();await page.locator('[data-ux-view="weekly"]').click();await page.locator('#uxWeeklyAdd').click();await expect(page.locator('#weeklyForm')).toBeVisible();expect(await page.evaluate(()=>auditWeekly===document.getElementById('weeklyForm'))).toBe(true);expect(calls.filter(u=>/weekly-main|weekly-reports/.test(u))).toHaveLength(weeklyCalls);
});

test('top creative opens full-size media and escaped copy lazily, supports carousel, mobile and cached reopening',async({page})=>{
 // Match the dated advertising fixture; keep CRM tests on the server's current day.
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 const key='a'.repeat(64);let calls=0;
 await page.route('**/top-creatives?*',r=>r.fulfill({json:{ok:true,rankings:{leads:[{provider:'meta_ads',rows:[{name:'Объявление с текстом',detailsKey:key,previewUrl:'https://scontent.xx.fbcdn.net/tiny.jpg',score:12,ctr:2,spend:120,currency:'EUR',freshness:'fresh'}]}]}}}));
 const art='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500"><rect width="1200" height="1500" fill="#0a1110"/><path d="M120 800L1030 450L600 1060L670 720Z" fill="#26ddcc"/><text x="90" y="200" fill="white" font-family="sans-serif" font-size="110">TOYS</text><text x="90" y="1370" fill="white" font-family="sans-serif" font-size="44">Creative preview · test fixture</text></svg>';
 await page.route('https://scontent.xx.fbcdn.net/**',r=>r.fulfill({contentType:'image/svg+xml',body:art}));
 await page.route('**/top-creatives/'+key+'?*',r=>{calls++;return r.fulfill({json:{ok:true,creative:{bodies:['Полный текст объявления\nВторая строка <script>window.unsafeCreative=true</script>'],titles:['Заголовок товара'],descriptions:['Описание товара'],media:[{kind:'image',url:'https://scontent.xx.fbcdn.net/full.jpg'},{kind:'image',url:'https://scontent.xx.fbcdn.net/second.jpg'}],destinationUrl:'https://example.test/product',callToAction:'SHOP_NOW',mediaStatus:'ready'}}});});
 await page.goto(portal);const open=page.getByRole('button',{name:'Открыть креатив: Объявление с текстом'});await expect(open).toBeVisible();expect(calls).toBe(0);await open.click();
 const dialog=page.getByRole('dialog',{name:'Объявление с текстом'});await expect(dialog).toBeVisible();await expect(dialog.locator('.creative-copy').first()).toContainText('Вторая строка <script>');expect(await page.evaluate(()=>window.unsafeCreative)).toBeUndefined();
 const media=dialog.locator('.creative-viewer-media img');await expect(media).toHaveAttribute('src','https://scontent.xx.fbcdn.net/full.jpg');await expect.poll(()=>media.evaluate(img=>img.naturalWidth)).toBe(1200);await expect(dialog.getByRole('link',{name:'Купить'})).toHaveAttribute('href','https://example.test/product');
 await page.screenshot({path:'dist/creative-viewer-desktop.png'});await dialog.getByRole('button',{name:'Следующий файл'}).click();await expect(media).toHaveAttribute('src','https://scontent.xx.fbcdn.net/second.jpg');await expect(dialog.locator('.creative-media-navigation span')).toHaveText('2 / 2');
 await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(open).toBeFocused();await open.click();await expect(dialog.locator('.creative-copy').first()).toContainText('Полный текст');expect(calls).toBe(1);
 await page.setViewportSize({width:390,height:844});expect(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth+1)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'dist/creative-viewer-mobile.png'});await dialog.getByRole('button',{name:'Закрыть креатив'}).click();expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
 await page.reload();await page.getByRole('button',{name:'Открыть креатив: Объявление с текстом'}).click();await expect(page.getByRole('dialog',{name:'Объявление с текстом'})).toContainText('Полный текст');expect(calls).toBe(1);
});
test('creative viewer recovers from Meta errors and releases video when closed without autoplay',async({page})=>{
 // Match the dated advertising fixture; keep CRM tests on the server's current day.
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 const key='b'.repeat(64);let calls=0;
 await page.route('**/top-creatives?*',r=>r.fulfill({json:{ok:true,rankings:{leads:[{provider:'meta_ads',rows:[{name:'Видео',detailsKey:key,previewUrl:'https://scontent.xx.fbcdn.net/poster.svg',score:2,ctr:1,spend:10,currency:'EUR'}]}]}}}));
 await page.route('https://scontent.xx.fbcdn.net/poster.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"/>'}));
 await page.route('https://scontent.xx.fbcdn.net/movie.mp4',()=>{});
 await page.route('**/top-creatives/'+key+'?*',r=>++calls===1?r.fulfill({status:503,json:{ok:false,error:'creative_unavailable'}}):r.fulfill({json:{ok:true,creative:{bodies:['Текст видео'],media:[{kind:'video',url:'https://scontent.xx.fbcdn.net/movie.mp4'}],mediaStatus:'ready',hasVideo:true}}}));
 await page.goto(portal);await page.getByRole('button',{name:'Открыть креатив: Видео'}).click();const dialog=page.getByRole('dialog',{name:'Видео',exact:true});await expect(dialog).toContainText('Не удалось получить креатив');await dialog.getByRole('button',{name:'Повторить загрузку'}).click();const video=dialog.locator('video');await expect(video).toBeVisible();expect(await video.evaluate(v=>v.controls&&!v.autoplay&&v.paused)).toBe(true);await dialog.getByRole('button',{name:'Закрыть креатив'}).click();expect(await page.locator('#creativeViewer video').evaluate(v=>v.paused&&!v.getAttribute('src'))).toBe(true);expect(calls).toBe(2);
});


test('missing and expired creative thumbnails recover from full media, reuse detail reads and never preload video',async({page})=>{
 // Match the dated advertising fixture; keep CRM tests on the server's current day.
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 const keys=['c','d','e'].map(c=>c.repeat(64)),calls=new Map(),seen=[];
 const rows=keys.map((detailsKey,i)=>({detailsKey,name:'Recovered '+i,previewUrl:i===1?'https://scontent.xx.fbcdn.net/expired.jpg':null,score:3-i,ctr:2,spend:30,currency:'EUR',freshness:'fresh'}));
 await page.route('**/top-creatives?*',r=>r.fulfill({json:{ok:true,rankings:Object.fromEntries(['leads','roas'].map(basis=>[basis,[{provider:'meta_ads',rows}]]))}}));
 await page.route('https://scontent.xx.fbcdn.net/**',r=>{seen.push(r.request().url());return r.request().url().endsWith('expired.jpg')?r.fulfill({status:403,body:'Expired'}):r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500"><rect width="1200" height="1500" fill="#26ddcc"/></svg>'});});
 await page.route('**/top-creatives/*?*',r=>{const key=new URL(r.request().url()).pathname.split('/').at(-1),i=keys.indexOf(key);calls.set(key,(calls.get(key)||0)+1);return r.fulfill({json:{ok:true,creative:{bodies:['Full copy '+i],media:i===2?[{kind:'video',url:'https://scontent.xx.fbcdn.net/never-preload.mp4',poster:'https://scontent.xx.fbcdn.net/poster.jpg'}]:[{kind:'image',url:'https://scontent.xx.fbcdn.net/full'+i+'.jpg'}]}}});});
 await page.goto(portal);await page.locator('.platform-top-creatives').scrollIntoViewIfNeeded();
 const previews=page.locator('.creative-preview');
 for(let i=0;i<3;i++){await expect(previews.nth(i).locator('img')).toHaveAttribute('src','https://scontent.xx.fbcdn.net/'+(i===2?'poster.jpg':'full'+i+'.jpg'));await expect.poll(()=>previews.nth(i).locator('img').evaluate(img=>img.naturalWidth)).toBe(1200);}
 expect(seen.some(u=>u.endsWith('.mp4'))).toBe(false);await expect(page.locator('.creative-preview-placeholder')).toHaveCount(0);expect([...calls.values()]).toEqual([1,1,1]);
 await page.getByRole('button',{name:'Открыть креатив: Recovered 0'}).click();await expect(page.getByRole('dialog')).toContainText('Full copy 0');await page.keyboard.press('Escape');expect(calls.get(keys[0])).toBe(1);
 await page.locator('[data-ranking="roas"]').click();await expect(page.locator('.creative-preview img')).toHaveCount(3);expect([...calls.values()]).toEqual([1,1,1]);await expect(page.locator('.creative-rank')).toHaveText(['1','2','3']);
});

test('opening a creative after a failed background preview replaces the missing-image placeholder',async({page})=>{
 // Match the dated advertising fixture; keep CRM tests on the server's current day.
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 const key='f'.repeat(64);let calls=0;
 await page.route('**/top-creatives?*',r=>r.fulfill({json:{ok:true,rankings:{leads:[{provider:'meta_ads',rows:[{name:'Retry preview',detailsKey:key,score:2,ctr:1,spend:5,currency:'EUR'}]}]}}}));
 await page.route('**/top-creatives/'+key+'?*',r=>++calls===1?r.fulfill({status:503,json:{ok:false}}):r.fulfill({json:{ok:true,creative:{media:[{kind:'image',url:'https://scontent.xx.fbcdn.net/recovered.svg'}],bodies:['Creative is available']}}}));
 await page.route('https://scontent.xx.fbcdn.net/recovered.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"/>'}));
 await page.goto(portal);await page.locator('.creative-preview').scrollIntoViewIfNeeded();await expect(page.locator('.creative-preview-placeholder')).toContainText('Не удалось загрузить предпросмотр');
 await page.getByRole('button',{name:'Открыть креатив: Retry preview'}).click();await expect(page.getByRole('dialog')).toContainText('Creative is available');await page.keyboard.press('Escape');
 await expect(page.locator('.creative-preview > img')).toHaveAttribute('src','https://scontent.xx.fbcdn.net/recovered.svg');await expect(page.locator('.creative-preview-placeholder')).toHaveCount(0);expect(calls).toBe(2);
});

async function mockDailyReview(page){
 const calls=[],reviewDate='2026-10-14';
 const reports=['critical','attention','healthy','insufficient'].map((priority,index)=>({
  project:{slug:'synthetic-'+index,name:index===0?'Project <img src=x onerror=alert(1)>':'Project '+index},priority,headline:'Проверка '+priority,recommendation:'Проверить измерение и сохранить бюджет.',accounts:[{provider:'meta_ads',currency:'CZK',timeZone:'Europe/Prague',periods:{day:{from:'2026-10-13',to:'2026-10-13'}},day:{spend:100,conversions:10,cpa:10,roas:null},checkedAt:'2026-10-14T05:20:00Z'}],crm:{available:false},findings:priority==='critical'?[{code:'cpa_up',severity:'critical',provider:'meta_ads',title:'Стоимость результата выросла',path:[{name:'Campaign <script>bad()</script>'},{name:'Group'},{name:'Ad'}],period:{from:'2026-10-13',to:'2026-10-13'},comparison:{from:'2026-10-06',to:'2026-10-12'},evidence:'CPA 20 CZK против 5 CZK.',recommendation:'Проверить целевое событие.',confidence:'medium',checkpoint:'Следующий закрытый день.'}]:[],findingCount:priority==='critical'?1:0,limitations:['Атрибуция может уточняться.']
 }));
 const state={fail:false,calls};
 await page.route('**/api/v2/master/daily-review*',r=>{
  const url=new URL(r.request().url());calls.push(url);
  if(state.fail)return r.fulfill({status:503,json:{ok:false,error:'review_unavailable'}});
  const date=url.searchParams.get('date')||reviewDate;
  return r.fulfill({json:{ok:true,reportDate:date,today:reviewDate,reports,history:[{date:reviewDate,state:'complete',generatedAt:'2026-10-14T05:30:00Z'},{date:'2026-10-13',state:'complete',generatedAt:'2026-10-13T05:30:00Z'}],counts:{critical:1,attention:1,healthy:1,insufficient:1},currentRun:{state:'complete'}}});
 });
 return state;
}
test('morning review has urgency colors, evidence, cached navigation, history and safe ad names',async({page})=>{
 const state=await mockDailyReview(page);await page.goto('/master/');const panel=page.locator('#dailyReview');await expect(page.locator('#projectsTable')).toBeVisible();await expect(panel).toBeHidden();expect(state.calls.length).toBe(0);await page.locator('[data-view=reviews]').click();await expect(page).toHaveURL(/#reviews$/);await expect(page.locator('#home')).toBeHidden();await expect(page.locator('#periodSeg')).toBeHidden();await expect(panel.locator('.review-project')).toHaveCount(4);
 const critical=panel.locator('.review-project.review-critical'),healthy=panel.locator('.review-project.review-healthy');
 expect(await critical.evaluate(el=>getComputedStyle(el).borderLeftColor)).not.toEqual(await healthy.evaluate(el=>getComputedStyle(el).borderLeftColor));
 await critical.locator('summary').click();await expect(critical.locator('.review-findings')).toContainText('Campaign <script>bad()</script>');await expect(critical.locator('script,img')).toHaveCount(0);await expect(critical).toContainText('Уверенность: средняя');
 await panel.locator('[data-review-priority=attention]').click();await expect(panel.locator('.review-project')).toHaveCount(1);await expect(panel.locator('.review-project')).toContainText('Project 1');
 await panel.locator('[data-review-priority=""]').click();await expect(panel.locator('.review-project')).toHaveCount(4);
 await page.locator('[data-view=crm]').click();await page.locator('[data-view=home]').click();await expect(panel).toBeHidden();await expect(page.locator('#periodSeg')).toBeVisible();await page.locator('[data-view=reviews]').click();expect(state.calls.length).toBe(1);await page.goBack();await expect(panel).toBeHidden();await page.goForward();await expect(panel).toBeVisible();
 // The master keeps the selected CRM project: return to all projects for this overview.
 await page.locator('#projectSelect').selectOption('');
 await panel.locator('select').selectOption('2026-10-13');await expect(panel.locator('.review-status')).toContainText('13.10.2026');expect(state.calls.length).toBe(2);
 await page.screenshot({path:'dist/daily-review-desktop.png',fullPage:true});
});
test('morning review remains legible on mobile and keeps saved cards if history loading fails',async({page})=>{
 await page.clock.install();
 const state=await mockDailyReview(page);await page.setViewportSize({width:390,height:844});await page.goto('/master/#reviews');const panel=page.locator('#dailyReview');await expect(panel.locator('.review-project')).toHaveCount(4);
 await page.evaluate(()=>{document.documentElement.dataset.theme='light';});await panel.locator('.review-project').first().locator('summary').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(panel.locator('select')).toBeVisible();
 state.fail=true;await panel.locator('select').selectOption('2026-10-13');await expect(panel.locator('.review-status')).toContainText('Повторим автоматически');await expect(panel.locator('.review-project')).toHaveCount(4);
 await expect(panel.locator('.review-status')).toContainText('Показан сохранённый обзор от 14.10.2026');
 state.fail=false;await page.clock.fastForward(60001);await expect(panel.locator('.review-status')).toContainText('Обзор от 13.10.2026');
 await page.screenshot({path:'dist/daily-review-mobile.png',fullPage:true});
});
test('client CRM does not mount or request agency morning reviews',async({page})=>{
 let requests=0;page.on('request',r=>{if(r.url().includes('/master/daily-review'))requests++;});
 await page.goto('/api/v2/projects/housevip-cxp7/content-crm');await expect(page.locator('#leadsBoard')).toBeVisible();await expect(page.locator('#dailyReview')).toHaveCount(0);expect(requests).toBe(0);
});

async function mockCachedStatistics(page){
 const state={calls:0,clicks:77,gate:null};
 await page.route('**/content-project/ads/hierarchy?*',async route=>{
  state.calls++;if(state.gate)await state.gate;const url=new URL(route.request().url()),range={from:url.searchParams.get('from'),to:url.searchParams.get('to')},observed=value=>({value:String(value),state:'observed'});
  await route.fulfill({json:{ok:true,providers:[{provider:'meta_ads',freshness:'fresh',requestedRange:range,hierarchy:{currency:'IDR',children:[{providerId:'cached',name:'Cached campaign',dailyMetrics:[{date:range.to,metrics:{impressions:observed(1000),clicks:observed(state.clicks),spend:observed(250),conversions:observed(4)}}],children:[]}]}}]}});
 });
 return state;
}
test('reload reuses snapshot, statistics, rankings and campaign pages without repeating data requests',async({page})=>{
 await page.clock.install({time:new Date('2026-10-14T06:07:00Z')});const stats=await mockCachedStatistics(page),campaigns=await mockCampaignBrowser(page),requests=[];
 page.on('request',r=>{if(/\/(dashboard|top-creatives)(?:\?|$)/.test(r.url()))requests.push(r.url());});
 await page.goto(portal);await expect(page.locator('#kClicks')).toHaveText('77');await expect(page.locator('.top-basis')).toBeVisible();
 await page.locator('[data-ux-view=campaigns]').click();await expect(page.locator('#platformCampaignBrowser')).toContainText('Lazy campaign');
 const before={stats:stats.calls,campaigns:campaigns.calls.length,requests:requests.length};
 await page.reload();await expect(page.locator('#kClicks')).toHaveText('77');await expect(page.locator('#platformCampaignBrowser')).toContainText('Lazy campaign');
 expect({stats:stats.calls,campaigns:campaigns.calls.length,requests:requests.length}).toEqual(before);
 // Returning to a known period uses that period's cache; a new period gets its own request.
 await page.locator('[data-ux-view=overview]').click();await page.locator('#periodSeg [data-days="1"]').click();await page.clock.fastForward(350);await expect.poll(()=>stats.calls).toBe(2);
 await page.reload();await expect(page.locator('#kClicks')).toHaveText('77');expect(stats.calls).toBe(2);
});
test('expired statistics stay visible during background refresh after reload and then update',async({page})=>{
 await page.clock.install({time:new Date('2026-10-14T06:07:00Z')});const stats=await mockCachedStatistics(page);await page.goto(portal);await expect(page.locator('#kClicks')).toHaveText('77');
 await page.evaluate(()=>{for(const key of Object.keys(sessionStorage))if(key.startsWith('toys-dashboard-cache:')){const value=JSON.parse(sessionStorage.getItem(key));value.expiresAt=Date.now()-1;sessionStorage.setItem(key,JSON.stringify(value));}});
 let release;stats.gate=new Promise(resolve=>release=resolve);stats.clicks=88;
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await expect(page.locator('#kClicks')).toHaveText('77');await expect(page.locator('#platformNotice')).toContainText('в фоне');
 release();await expect(page.locator('#kClicks')).toHaveText('88');expect(stats.calls).toBe(2);
});
test('master reload reuses project summaries and the saved morning review',async({page})=>{
 await page.clock.install({time:new Date('2026-10-14T06:07:00Z')});const daily=await mockDailyReview(page);let summaryCalls=0;
 page.on('request',r=>{if(r.url().includes('/master/projects/')&&r.url().includes('/summary?'))summaryCalls++;});
 await page.goto('/master/');await expect(page.locator('#updated')).toContainText('Обновлено');expect(daily.calls.length).toBe(0);const before=summaryCalls;
 await page.reload();await expect(page.locator('#updated')).toContainText('Обновлено');expect(summaryCalls).toBe(before);
 await page.locator('[data-view=reviews]').click();await expect(page.locator('#dailyReview .review-project')).toHaveCount(4);await page.reload();await expect(page.locator('[data-view=reviews]')).toHaveClass('active');await expect(page.locator('#dailyReview .review-project')).toHaveCount(4);expect(summaryCalls).toBe(before);expect(daily.calls.length).toBe(1);
});
test('changing account role cannot reuse the previous private dashboard cache',async({page})=>{
 await page.clock.install({time:new Date('2026-10-14T06:07:00Z')});const stats=await mockCachedStatistics(page);await page.goto(portal);await expect(page.locator('#kClicks')).toHaveText('77');const previous=await page.evaluate(()=>window.TOYS_CACHE_SCOPE);
 await page.setExtraHTTPHeaders({'x-test-viewer':'true'});stats.clicks=33;await page.reload();await expect(page.locator('#kClicks')).toHaveText('33');expect(stats.calls).toBe(2);expect(await page.evaluate(()=>window.TOYS_CACHE_SCOPE)).not.toEqual(previous);expect(await page.evaluate(async old=>(await caches.keys()).includes('toys-dashboard-cache:responses:'+old),previous)).toBe(false);
});
test('large history restores after reload without another dashboard download',async({page})=>{
 await page.clock.install({time:new Date('2026-10-14T06:07:00Z')});await mockCachedStatistics(page);let downloads=0;
 await page.route('**/api/v2/projects/housevip-cxp7/dashboard',async route=>{downloads++;const response=await route.fetch(),data=await response.json();data.dashboard.syntheticHistory=Array.from({length:20000},(_,i)=>({date:'2026-10-14',campaign:'Synthetic '+i,metrics:{impressions:1000,clicks:10,spend:15.7},padding:'campaign history '.repeat(12)}));await route.fulfill({json:data});});
 await page.goto(portal);await expect(page.locator('#kClicks')).toHaveText('77');
 expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.endsWith('/dashboard')).some(k=>JSON.parse(sessionStorage.getItem(k)).encoding==='gzip'))).toBe(true);
 await page.reload();await expect(page.locator('#kClicks')).toHaveText('77');expect(downloads).toBe(1);
});
test('CRM writes update CRM summaries without invalidating advertising statistics',async({page})=>{
 await page.clock.install({time:new Date('2026-10-14T06:07:00Z')});const stats=await mockCachedStatistics(page);await page.goto(portal);await expect(page.locator('#kClicks')).toHaveText('77');
 await page.locator('#platformCRMNav').click();await page.locator('#newLead').click();await page.locator('[name=name]').fill('Saved cache invalidation');await page.locator('[name=phone]').fill('+995555019922');stats.clicks=88;
 await page.getByRole('button',{name:'Добавить',exact:true}).click();await expect(page.locator('#leadsBoard')).toContainText('Saved cache invalidation');
 await page.getByRole('link',{name:'Главная',exact:true}).click();
 await page.reload();await expect(page.locator('#kClicks')).toHaveText('77');expect(stats.calls).toBe(1);
 await page.reload();await expect(page.locator('#kClicks')).toHaveText('77');expect(stats.calls).toBe(1);
});
test('master direct Meta setup validates before connecting and displays conflicts without claiming delivery',async({page})=>{
 await page.route('**/api/v2/master',async route=>{const response=await route.fetch(),data=await response.json();data.pages=[{id:'123456',name:'Synthetic Meta page',projectId:'prj_housevip_cxp7'}];await route.fulfill({json:data});});
 const requests=[];let fail=false;
 await page.route('**/crm/connections/direct-meta',async route=>{const body=route.request().postDataJSON();requests.push(body);expect(body.pageId).toBe('123456');expect(body.appId).toBe('654321');await route.fulfill({status:fail?409:200,json:fail?{ok:false,error:'app_callback_conflict'}:{ok:true,leadReadAccess:true,callbackReady:body.action==='connect',pageReady:body.action==='connect',state:'awaiting_lead'}});});
 await page.goto('/master/#crm');await page.locator('#connections').click();await expect(page.locator('#directMetaConnection')).toContainText('Доставка реального лида пока не подтверждена');expect(requests).toHaveLength(0);
 await page.locator('#directMetaForm [name=pageId]').fill('123456');await page.locator('#directMetaForm [name=appId]').fill('654321');await page.getByRole('button',{name:'Проверить доступ',exact:true}).click();await expect(page.locator('#directMetaStatus')).toContainText('Доступ к лидам подтверждён');expect(requests[0].action).toBe('check');
 fail=true;await page.getByRole('button',{name:'Подключить напрямую',exact:true}).click();await expect(page.locator('#directMetaStatus')).toContainText('уже настроен другой адрес');await expect(page.locator('#directMetaStatus')).not.toContainText('подтвердила подключение');
 fail=false;await page.getByRole('button',{name:'Подключить напрямую',exact:true}).click();await expect(page.locator('#directMetaStatus')).toContainText('Ожидаем первую заявку');expect(requests).toHaveLength(3);
});

test('master pre-fills an undiscovered project page without connecting automatically and keeps a replacement secret for activation',async({page})=>{
 await page.route('**/crm/connections',async route=>{const response=await route.fetch(),data=await response.json();data.pages=[];data.directMeta={...data.directMeta,suggestedPageId:'987654321',suggestedAppId:'654321',lastDeliveredAt:null};await route.fulfill({json:data});});
 const requests=[];
 await page.route('**/crm/connections/direct-meta',async route=>{const body=route.request().postDataJSON();requests.push(body);await route.fulfill({json:{ok:true,leadReadAccess:true,callbackReady:body.action==='connect',pageReady:body.action==='connect'}});});
 await page.goto('/master/#crm');await page.locator('#connections').click();
 await expect(page.locator('#directMetaForm [name=pageId]')).toHaveValue('987654321');await expect(page.locator('#directMetaForm [name=appId]')).toHaveValue('654321');expect(requests).toHaveLength(0);
 await page.locator('#directMetaForm summary').click();await page.locator('#directMetaForm [name=appSecret]').fill('b'.repeat(32));
 await page.getByRole('button',{name:'Проверить доступ',exact:true}).click();await expect(page.locator('#directMetaStatus')).toContainText('Доступ к лидам подтверждён');
 await expect(page.locator('#directMetaForm [name=appSecret]')).toHaveValue('b'.repeat(32));
 await page.getByRole('button',{name:'Подключить напрямую',exact:true}).click();await expect(page.locator('#directMetaStatus')).toContainText('Ожидаем первую заявку');
 expect(requests.map(r=>r.pageId)).toEqual(['987654321','987654321']);expect(requests[1].appSecret).toBe('b'.repeat(32));await expect(page.locator('#directMetaForm [name=appSecret]')).toHaveValue('');
});
test('large responses survive session-cache eviction and a new tab without downloading advertising again',async({page,context})=>{
 await page.clock.install({time:new Date('2026-10-14T06:07:00Z')});await mockCachedStatistics(page);let downloads=0;
 const noise=Array.from({length:70000},()=>crypto.randomUUID()).join('');
 await context.route('**/api/v2/projects/housevip-cxp7/dashboard',async route=>{downloads++;const response=await route.fetch(),data=await response.json();data.dashboard.syntheticNoise=noise;await route.fulfill({json:data});});
 await page.goto(portal);await expect(page.locator('#kClicks')).toHaveText('77');
 expect(await page.evaluate(()=>Object.keys(sessionStorage).some(k=>k.endsWith('/dashboard')))).toBe(false);
 expect(await page.evaluate(async()=>{for(const name of await caches.keys())if(name.startsWith('toys-dashboard-cache:responses:')){const store=await caches.open(name);if((await store.keys()).some(r=>decodeURIComponent(r.url).endsWith('/dashboard')))return true;}return false;})).toBe(true);
 await page.evaluate(()=>sessionStorage.clear());await page.reload();await expect(page.locator('#kClicks')).toHaveText('77');expect(downloads).toBe(1);
 const second=await context.newPage();await second.clock.install({time:new Date('2026-10-14T06:08:00Z')});await second.goto(portal);await expect(second.locator('#kClicks')).toHaveText('77');expect(downloads).toBe(1);await second.close();
});
test('partial history stays cached through navigation and reloads until the next import slot',async({page})=>{
 await page.clock.install({time:new Date('2026-10-14T06:03:00Z')});let reads=0;
 await page.route('**/content-project/ads/hierarchy?*',route=>{reads++;return route.fulfill({json:{ok:true,refreshing:false,providers:[{provider:'meta_ads',freshness:'partial',hierarchy:null}]}});});
 await page.goto(portal);await expect.poll(()=>reads).toBe(1);await page.clock.fastForward(3*60000);
 await page.locator('#platformCRMNav').click();await page.getByRole('link',{name:'Главная',exact:true}).click();await page.reload();await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');expect(reads).toBe(1);
 await page.clock.fastForward(16*60000);await expect.poll(()=>reads).toBe(2);
});
test('returning to a cached campaign search reuses its completed response',async({page})=>{
 await page.clock.install({time:new Date('2026-10-14T06:03:00Z')});const fixture=await mockCampaignBrowser(page);
 await page.goto(portal);await page.locator('[data-ux-view=campaigns]').click();await expect(page.locator('#platformCampaignBrowser')).toContainText('Lazy campaign');const count=fixture.calls.length;
 await page.locator('#platformCampaignBrowser input[type=search]').fill('other');await page.clock.fastForward(300);
 await expect.poll(()=>fixture.calls.length).toBe(count+1);
 await page.locator('#platformCampaignBrowser input[type=search]').fill('');await page.clock.fastForward(300);await expect(page.locator('#platformCampaignBrowser')).toContainText('Lazy campaign');expect(fixture.calls.length).toBe(count+1);
});

test('client lead card exposes original request and full imported comments separately from new note entry',async({page,request})=>{
 const api='/api/v2/projects/housevip-cxp7/crm';
 const created=await request.post(api,{headers:{'x-idempotency-key':'imported-notes-ui',origin:'http://127.0.0.1:4173'},data:{name:'Imported comment UI',phone:'+995555019911'}});expect(created.ok()).toBe(true);
 await page.route('**/housevip-cxp7/crm?*',async route=>{const response=await route.fetch(),data=await response.json();for(const l of [...(data.leads||[]),...(data.columns||[]).flatMap(c=>c.leads)])if(l.name==='Imported comment UI')l.metadata={migration:'test',description:'Old agency note',sourceRequest:{text:'Original request\n<script>never execute</script>',service:'Bodywork'}};await route.fulfill({json:data});});
 await page.route('**/housevip-cxp7/crm/leads/*',async route=>{if(route.request().method()!=='GET')return route.fallback();await route.fulfill({json:{ok:true,messages:[],events:[{status:'Новый',date:'2026-10-01T08:00:00Z',note:JSON.stringify({migration:true,note:'Original agency note'})},{status:'В работе',date:'2026-10-15T08:00:00Z',note:JSON.stringify({kind:'imported_comment',note:'Updated comment\\nSecond line <img src=x onerror=alert(1)>'})}]}});});
 await page.goto('/api/v2/projects/housevip-cxp7/content-crm');await page.locator('#search').fill('Imported comment UI');await page.getByRole('button',{name:'Imported comment UI',exact:true}).click();
 await expect(page.locator('.lead-request')).toContainText('Original request');await expect(page.locator('.lead-request')).toContainText('<script>never execute</script>');await expect(page.locator('#leadComments')).toContainText('Original agency note');
 const latest=page.locator('#leadComments .history-entry').first();await expect(latest).toContainText('Updated comment');expect(await latest.locator('p').textContent()).toContain('Updated comment\nSecond line');await expect(page.locator('#leadComments img,.lead-request script')).toHaveCount(0);await expect(page.locator('#leadForm [name=note]')).toHaveValue('');await expect(page.locator('#leadHistory')).toContainText('Комментарий из таблицы');
});

test('TOYS Agency clean URL routes through Pages, requires login and keeps dashboard navigation',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-13T06:07:00Z'));
 await page.setExtraHTTPHeaders({'x-test-public':'true'});const redirect=page.waitForResponse(r=>r.url().endsWith('/toys-agency-ctft/')&&r.status()===302);await page.goto('/toys-agency-ctft/');expect(['/login','/api/v2/portal/session?choose=1']).toContain((await redirect).headers().location);await expect(page).toHaveURL(/\/(?:login|api\/v2\/portal\/session\?choose=1)$/);await expect(page.locator('body')).not.toContainText('"error":"not_found"');
 await page.setExtraHTTPHeaders({});
 // Reuse the synthetic HOUSEVIP dataset for TOYS project API payloads only.
 // The clean URL, Pages forwarding, authorization and HTML use the real TOYS route.
 await page.route('**/api/v2/projects/toys-agency-ctft/**',async route=>{
  const response=await route.fetch({url:route.request().url().replace('/projects/toys-agency-ctft/','/projects/housevip-cxp7/')});await route.fulfill({response});
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/toys-agency-ctft/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');expect(await page.evaluate(()=>window.TOYS_UNIFIED_PROJECT)).toBe('toys-agency-ctft');
 await expect(page.locator('#mainCards')).toBeVisible();
 await page.locator('[data-ux-view="weekly"]').click();await expect(page.locator('#weeklyContent')).not.toBeEmpty();await page.locator('#uxWeeklyAdd').click();await expect(page.locator('#weeklyForm')).toBeVisible();
 await page.locator('[data-ux-view="overview"]').click();await expect(page.locator('#mainCards')).toBeVisible();await page.reload();await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'dist/toys-agency-route-mobile.png',fullPage:true});expect(errors).toEqual([]);
});

for(const viewer of [false,true])test(`PROFKIT current periods and independent sales coverage (${viewer?'client':'admin'})`,async({page,request})=>{
 await page.clock.setFixedTime(new Date('2026-10-16T10:07:00Z'));
 if(viewer)await page.setExtraHTTPHeaders({'x-test-viewer':'true'});
 const errors=[],reads=[];page.on('pageerror',e=>errors.push(e.message));
 const slug='profkit-instashop-r4vk',d=await(await request.get('/api/v2/projects/housevip-cxp7/dashboard')).json();
 const observed=(metricCode,value,currency=null)=>({metricCode,value:String(value),state:'observed',currency});
 const dates=(from,to)=>Array.from({length:Math.floor((Date.parse(to)-Date.parse(from))/86400000)+1},(_,i)=>new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10));
 const ad=date=>({date,campaign:{label:'PROFKIT campaign'},metrics:[observed('ads.spend_uah',410,'UAH'),observed('ads.raw_spend_usd',10,'USD'),observed('ads.impressions',1000),observed('ads.clicks',25),observed('instashop.meta_direct',4)]});
 d.dashboard.project.slug=slug;d.dashboard.project.name='PROFKIT';delete d.dashboard.advertising;
 d.dashboard.instashop={ads:{rows:dates('2026-10-07','2026-10-11').map(ad)},sales:{rows:dates('2026-10-07','2026-10-15').map(date=>({date,metrics:[observed('instashop.sales_count',2),observed('instashop.revenue_uah',1000,'UAH'),observed('instashop.direct_inquiries',10),observed('instashop.qualified_inquiries',8),observed('instashop.unqualified_inquiries',2)]}))}};
 await page.route('**/projects/'+slug+'/dashboard*',r=>r.fulfill({json:d}));
 await page.route('**/projects/'+slug+'/content/tabs',r=>r.fulfill({json:{ok:true,tabs:[]}}));
 await page.route('**/projects/'+slug+'/weekly-reports',r=>r.fulfill({json:{ok:true,reports:[]}}));
 await page.route(/\/projects\/profkit-instashop-r4vk\/(content-project\/ads\/hierarchy|ads-summary)\?/,r=>{
  const u=new URL(r.request().url()),requestedRange={from:u.searchParams.get('from'),to:u.searchParams.get('to')},coveredDates=dates(requestedRange.from,requestedRange.to);reads.push(requestedRange);
  const m=value=>({state:'observed',value:String(value)}),dailyMetrics=coveredDates.map(date=>({date,metrics:{spend:m(10),impressions:m(1000),clicks:m(25),conversions:m(4)}}));
  return r.fulfill({json:{ok:true,exchangeRates:coveredDates.map(date=>({date,rate:41})),providers:[{provider:'meta_ads',freshness:'fresh',requestedRange,coveredDates,fetchedAt:'2026-10-16T10:00:00Z',hierarchy:{currency:'USD',children:[{providerId:'campaign',name:'PROFKIT campaign',dailyMetrics,children:[]}]}}]}});
 });
 await page.route('**/projects/'+slug+'/top-creatives?*',r=>r.fulfill({json:{ok:true,rankings:{roas:[],purchases:[],leads:[],qualifiedLeads:[]}}}));
 await mockCampaignBrowser(page);
 await page.goto('/'+slug+'/#weekly');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 if(viewer)await expect(page.locator('#openWeekly')).toBeHidden();
 await expect(page.locator('#to')).toHaveValue('2026-10-16');await expect(page.locator('#from')).toHaveValue('2026-10-10');
 await expect(page.locator('#updated')).toHaveText('Реклама: 2026-10-16 · Продажи: 2026-10-15');
 await page.locator('#periodSeg [data-days="max"]').click();await expect(page.locator('#to')).toHaveValue('2026-10-16');await expect(page.locator('#from')).toHaveValue('2026-10-07');
 await page.locator('#uxNav [data-ux-view="overview"]').click();
 const metric=label=>page.locator('#cards .card').filter({has:page.locator('.label',{hasText:new RegExp('^'+label+'$')})}).locator('.value');
 await expect(metric('Продажи')).toHaveText('18');await expect(metric('ROAS')).toHaveText('—');await expect(page.locator('#platformSalesCoverage')).toBeVisible();
 await page.locator('#periodSeg [data-days="1"]').click();await expect(page.locator('#from')).toHaveValue('2026-10-16');await expect(metric('Продажи')).toHaveText('—');
 await expect.poll(()=>reads.at(-1)?.from).toBe('2026-10-16');await expect(metric('Расход')).toHaveText('410 ₴');
 await page.locator('#platformCalendar').click();await page.locator('[data-date="2026-10-09"]').click();await page.locator('[data-date="2026-10-15"]').click();await page.getByRole('button',{name:'Применить',exact:true}).click();
 await expect(metric('Продажи')).toHaveText('14');await expect(metric('Выручка')).toHaveText(/7\s?000 ₴/);await expect(page.locator('#platformSalesCoverage')).toBeHidden();await expect(metric('ROAS')).toHaveText('2.44×');
 await page.locator('#periodSeg [data-days="30"]').click();await expect(page.locator('#to')).toHaveValue('2026-10-16');
 await page.locator('#uxNav [data-ux-view="campaigns"]').click();await expect(page.locator('#uxCampaigns')).toBeVisible();
 await page.locator('#uxNav [data-ux-view="overview"]').click();await page.screenshot({path:'dist/profkit-coverage-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'dist/profkit-coverage-mobile.png',fullPage:true});
 const initialReads=reads.filter(r=>r.from==='2026-10-10'&&r.to==='2026-10-16').length;
 await page.reload();await expect(page.locator('#to')).toHaveValue('2026-10-16');await expect(page.locator('#updated')).toHaveText('Реклама: 2026-10-16 · Продажи: 2026-10-15');
 expect(reads.filter(r=>r.from==='2026-10-10'&&r.to==='2026-10-16').length).toBe(initialReads);
 expect(errors).toEqual([]);
});
