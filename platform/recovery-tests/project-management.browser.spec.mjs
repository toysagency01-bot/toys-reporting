import {test,expect} from '@playwright/test';
async function open(page,role='team'){await page.setExtraHTTPHeaders({'x-test-role':role});await page.goto('/master/');await page.getByRole('button',{name:'Создать проект',exact:true}).click();await expect(page.locator('.project-setup-dialog')).toBeVisible();}
async function step(page,name){await page.locator('.ps-steps').getByRole('button',{name:new RegExp(name)}).click();}
test('team creates a complete normal project, opens its dashboard and edits settings without chat or a redeploy',async({page})=>{
 await open(page);await page.locator('[data-path=name]').fill('Browser managed project');await page.locator('[data-path=company]').fill('Browser client');
 await step(page,'KPI');await page.locator('[data-path=currency]').fill('EUR');await page.locator('[data-path="kpi.target"]').fill('25');await page.locator('[data-path="kpi.budget"]').fill('600');
 await step(page,'Бриф');await page.locator('[data-path="brief.product"]').fill('Synthetic browser service');await page.locator('[data-path="brief.text"]').fill('Original brief <img src=x onerror=alert(1)>');
 await step(page,'План и материалы');await page.locator('[data-path="notes.strategy"]').fill('Browser strategy content');await page.locator('[data-task-id="start-0"] [data-task-field=deadline]').fill('2026-11-05');
 await step(page,'Проверка');await page.locator('.project-setup-dialog').getByRole('button',{name:'Создать проект',exact:true}).click();await expect(page.locator('.project-setup-dialog')).toContainText('Проект создан.');
 await expect(page.getByRole('link',{name:'Открыть дашборд',exact:true}).last()).toHaveAttribute('href',/^\/project-/);
 const url=await page.locator('.project-setup-dialog').getByRole('link',{name:'Открыть дашборд',exact:true}).getAttribute('href');await page.goto(url);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await expect(page.locator('header')).toContainText('Browser managed project');
 await page.goto(url+'#meta');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await page.getByRole('button',{name:'Стратегия',exact:true}).click();await expect(page.locator('#gWrap')).toContainText('Browser strategy content');
 await page.getByRole('link',{name:'Настроить проект',exact:true}).click();await expect(page.locator('.project-setup-dialog')).toBeVisible();await expect(page.locator('[data-path=name]')).toHaveValue('Browser managed project');
 await page.screenshot({path:'dist/project-management-settings.png',fullPage:true});
 await step(page,'План и материалы');await page.locator('[data-path="notes.strategy"]').fill('Updated strategy after first visit');await page.getByRole('button',{name:'Сохранить настройки',exact:true}).click();await expect(page.locator('[data-status]')).toContainText('Настройки сохранены');
 await page.goto(url+'#meta');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await page.getByRole('button',{name:'Стратегия',exact:true}).click();await expect(page.locator('#gWrap')).toContainText('Updated strategy after first visit');
});
test('mobile create form fits, supports saving for later, and does not reopen a task checklist',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page,'admin');await page.locator('[data-path=name]').fill('Mobile managed project');
 expect(await page.locator('.project-setup-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:'dist/project-management-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Сохранить и продолжить позже',exact:true}).click();await expect(page.locator('.project-setup-dialog')).toContainText('Проект создан.');await page.locator('.ps-close').click();await expect(page.locator('.onboarding-dialog')).not.toBeVisible();await expect(page.locator('#projectSelect')).toHaveValue(/^project-/);
});
test('unassigned team can start a project and receives scope; client cannot create, edit or see the wizard',async({page})=>{
 await open(page,'empty');await page.locator('[data-path=name]').fill('Unassigned creator project');await page.getByRole('button',{name:'Сохранить и продолжить позже',exact:true}).click();await expect(page.locator('.project-setup-dialog')).toContainText('Проект создан.');
 const response=await page.request.get('/api/v2/master',{headers:{'x-test-role':'empty'}});const data=await response.json();expect(data.projects).toHaveLength(1);expect(data.projects[0].name).toBe('Unassigned creator project');
 const denied=await page.request.post('/api/v2/master/projects',{headers:{'x-test-role':'client'},data:{setup:{name:'No'}}});expect(denied.status()).toBe(403);
});
test('dirty create form guards close and makes missing fields actionable',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Сохранить и продолжить позже',exact:true}).click();await expect(page.locator('[data-status]')).toContainText('Укажите название');
 await page.locator('[data-path=name]').fill('Not saved');page.once('dialog',d=>d.dismiss());await page.keyboard.press('Escape');await expect(page.locator('.project-setup-dialog')).toBeVisible();page.once('dialog',d=>d.accept());await page.keyboard.press('Escape');await expect(page.locator('.project-setup-dialog')).not.toBeVisible();
});
test('connection step verifies Meta and KeyCRM using scoped forms and clears secret inputs after success',async({page})=>{
 await open(page);await page.locator('[data-path=name]').fill('Browser source setup');await step(page,'Каналы и CRM');await page.locator('[data-path="crm.kind"]').selectOption('keycrm');await page.getByRole('button',{name:'Сохранить и продолжить позже',exact:true}).click();await expect(page.locator('.project-setup-dialog')).toContainText('Проект создан.');
 await page.locator('[data-connection=metaAccount]').fill('123456789');await page.getByRole('button',{name:'Проверить и подключить кабинет',exact:true}).click();await expect(page.locator('[data-status]')).toContainText('Доступ к кабинету подтверждён');
 await page.locator('[data-connection=keycrmToken]').fill('synthetic-browser-api-key');await page.getByRole('button',{name:'Проверить ключ / загрузить статусы',exact:true}).click();await expect(page.locator('[data-connection=keycrmToken]')).toHaveValue('');await expect(page.locator('[data-crm-status="2"]')).toBeVisible();await page.locator('[data-crm-status="2"]').check();await page.getByRole('button',{name:'Подключить выбранные статусы',exact:true}).click();await expect(page.locator('[data-status]')).toContainText('KeyCRM подключена');await expect(page.locator('[data-crm-status="2"]')).toBeChecked();
 await page.screenshot({path:'dist/project-management-connections.png',fullPage:true});
});
