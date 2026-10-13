import {test,expect} from '@playwright/test';
const crm='/api/v2/projects/housevip-cxp7/content-crm';
const stages=['Новый','Не удалось связаться','Связались','Квалифицирован','Подбор объекта','Просмотр назначен','Просмотр проведён','Переговоры','Бронь / задаток','Сделка','Отказ','Отложен','Неактуален'];
async function create(page,name){await page.locator('#newLead').click();await page.locator('[name=name]').fill(name);await page.locator('[name=phone]').fill('+995555010001');await page.getByRole('button',{name:'Добавить',exact:true}).click();await expect(page.getByRole('button',{name,exact:true})).toBeVisible();}
const metric=(page,label)=>page.locator('#crmSummary .card').filter({has:page.locator('.label',{hasText:label})}).locator('.value');

test('real-estate board uses 13 stages in columns, filters and editor, with correct deal metrics',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1600,height:1000});await page.goto(crm);
 await expect(page.locator('.stage-heading h3')).toHaveText(stages);await expect(page.locator('#statusFilter option')).toHaveText(['Все статусы',...stages]);await expect(page.locator('#funnelName')).toHaveText('Воронка недвижимости');
 await create(page,'Estate browser lead');await page.locator('#search').fill('Estate browser lead');await expect(page.locator('#leadCount')).toHaveText('1');
 const card=page.getByRole('button',{name:'Estate browser lead',exact:true});await card.click();await expect(page.locator('#leadForm [name=status] option')).toHaveText(stages);
 await page.locator('[name=status]').selectOption('Подбор объекта');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(metric(page,'Квалифицированы')).toHaveText('1');await expect(metric(page,'Продажи')).toHaveText('0');
 await card.click();await page.locator('[name=status]').selectOption('Бронь / задаток');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(metric(page,'Квалифицированы')).toHaveText('1');await expect(metric(page,'Продажи')).toHaveText('0');
 await card.click();await page.locator('[name=status]').selectOption('Сделка');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(page.locator('#leadForm [role=status]')).toContainText('сумму');await page.locator('[name=value]').fill('160000');await page.locator('[name=currency]').fill('EUR');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(metric(page,'Продажи')).toHaveText('1');await expect(metric(page,'Выручка CRM')).toContainText('EUR');
 const slider=page.getByRole('slider',{name:'Прокрутка этапов'});await slider.focus();await slider.press('End');await expect(page.locator('[data-stage="Неактуален"] .stage-heading')).toBeInViewport();await expect(page.locator('[data-stage="Отложен"] .stage-heading')).toBeInViewport();
 await page.locator('#statusFilter').selectOption('Сделка');await expect(page.locator('.kanban-column')).toHaveCount(1);await expect(page.locator('.lead-card')).toContainText('Estate browser lead');
 await page.locator('#statusFilter').selectOption('');await page.locator('#theme').click();await page.screenshot({path:'dist/crm-real-estate.png',animations:'disabled',fullPage:true});
 await page.reload();await page.locator('#search').fill('Estate browser lead');await expect(page.locator('[data-stage="Сделка"]')).toContainText('Estate browser lead');
 await card.click();await page.locator('#deleteLead').click();await expect(page.locator('#deleteConfirmation')).toBeVisible();await page.locator('#deleteCancel').click();await expect(page.locator('#editor')).toBeVisible();
 await page.locator('#deleteLead').click();await page.locator('#deleteLeadForm button[type=submit]').click();await expect(page.locator('#editor')).toBeHidden();await expect(page.locator('#leadCount')).toHaveText('0');await expect(metric(page,'Продажи')).toHaveText('0');await expect(metric(page,'Выручка CRM')).toHaveText('0');
 await page.reload();await page.locator('#search').fill('Estate browser lead');await expect(page.locator('#leadCount')).toHaveText('0');expect(errors).toEqual([]);
});

test('kanban deletion works without opening the lead, supports cancellation and remains usable on mobile',async({page})=>{
 await page.goto(crm);await create(page,'Delete from board');await page.locator('#search').fill('Delete from board');await expect(page.locator('#leadCount')).toHaveText('1');
 const remove=page.getByRole('button',{name:'Удалить лида Delete from board',exact:true});await remove.click();await expect(page.locator('#editor')).toBeHidden();await expect(page.locator('#deleteContact')).toContainText('Delete from board');await page.locator('#deleteCancel').click();await expect(page.locator('.lead-card')).toHaveCount(1);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await remove.click();await expect(page.locator('#deleteConfirmation')).toBeVisible();await page.screenshot({path:'dist/crm-delete-mobile.png',animations:'disabled'});await page.locator('#deleteLeadForm button[type=submit]').click();await expect(page.locator('#leadCount')).toHaveText('0');await expect(page.locator('.lead-card')).toHaveCount(0);
 await page.getByRole('link',{name:'Главная',exact:true}).click();await page.locator('#platformCRMNav').click();await expect(page.locator('#leadCount')).toHaveText('0');
});
