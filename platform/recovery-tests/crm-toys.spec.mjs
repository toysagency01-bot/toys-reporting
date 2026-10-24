import {test,expect} from '@playwright/test';
const stages=['Новые','Первичный контакт','Фолоу ап 1','Фолоу ап 2','Вышел на связь','Квалифицирован','Кикоф митинг','Готовим КП аудит','Презентовали КП','Согласование договора','Отложенные (перспективные)','Отложенные (малоперспективные)','Нет ответа, без номера, мусор','Успешно реализовано','Закрыто, но не реализовано'];
test('TOYS stages work in the kanban, filters, editor, qualification and sale flow on desktop and mobile',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});
 await page.goto('/api/v2/projects/housevip-cxp7/content-crm');
 await expect(page.locator('.stage-heading h3')).toHaveText(stages);await expect(page.locator('#statusFilter option')).toHaveText(['Все статусы',...stages]);await expect(page.locator('#funnelName')).toHaveText('Основная');
 await page.locator('#newLead').click();await page.locator('[name=name]').fill('Synthetic TOYS');await page.locator('[name=phone]').fill('+995555010001');await page.locator('#editor button[type=submit]').click();
 const card=page.getByRole('button',{name:'Synthetic TOYS',exact:true}),column=s=>page.locator(`[data-stage="${s}"]`);
 await expect(column('Новые')).toContainText('Synthetic TOYS');await card.dragTo(column('Первичный контакт').locator('.stage-heading'));await expect(column('Первичный контакт')).toContainText('Synthetic TOYS');
 await card.click();await expect(page.locator('#leadForm [name=status] option')).toHaveText(stages);
 const move=async status=>{await page.locator('#leadForm [name=status]').selectOption(status);await page.locator('#leadForm button[type=submit]').click();};
 await move('Квалифицирован');await expect(page.locator('#crmSummary .value').first()).toHaveText('1');await card.click();await move('Кикоф митинг');await expect(page.locator('#crmSummary .value').first()).toHaveText('1');
 await card.click();await move('Успешно реализовано');await expect(page.locator('#leadForm [role=status]')).toContainText('сумму');await page.locator('#leadForm [name=value]').fill('1500');await page.locator('#leadForm [name=currency]').fill('EUR');await page.locator('#leadForm button[type=submit]').click();await expect(page.locator('#editor')).toBeHidden();
 await expect(page.locator('#crmSummary .value').first()).toHaveText('1');await expect(page.locator('#crmSummary .value').nth(1)).toHaveText('1');await expect(page.locator('#crmSummary .value').nth(2)).toContainText('€');
 // Deferred, junk and lost columns must not qualify merely because they are further right.
 for(const status of ['Отложенные (перспективные)','Отложенные (малоперспективные)','Нет ответа, без номера, мусор','Закрыто, но не реализовано']){
  await card.click();await move(status);await expect(page.locator('#crmSummary .value').first()).toHaveText('0');await expect(page.locator('#crmSummary .value').nth(1)).toHaveText('0');
  await card.click();await move('Кикоф митинг');await expect(page.locator('#crmSummary .value').first()).toHaveText('1');
 }
 await card.click();await move('Успешно реализовано');await expect(page.locator('#crmSummary .value').first()).toHaveText('1');
 await page.locator('#statusFilter').selectOption('Успешно реализовано');await expect(page.locator('.kanban-column')).toHaveCount(1);await expect(card).toBeVisible();
 await page.locator('#statusFilter').selectOption('');const slider=page.getByRole('slider',{name:'Прокрутка этапов'});await slider.focus();await slider.press('End');await expect(column('Закрыто, но не реализовано').locator('.stage-heading')).toBeInViewport();
 await expect(page.locator('#crmSummary .card').first()).toHaveCSS('opacity','1');
 await page.screenshot({path:'dist/crm-toys-desktop.png'});
 await page.setViewportSize({width:390,height:844});await slider.focus();await slider.press('End');await expect(column('Закрыто, но не реализовано').locator('.stage-heading')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'dist/crm-toys-mobile.png',animations:'disabled'});
 await page.reload();await page.locator('#statusFilter').selectOption('Успешно реализовано');await expect(card).toBeVisible();expect(errors).toEqual([]);
});
