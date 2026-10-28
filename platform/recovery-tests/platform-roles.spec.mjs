import {test,expect} from '@playwright/test';
test('admin assigns team projects, grants roles, and sees all projects on desktop and mobile',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/master/#access');await expect(page.locator('#newClient')).toHaveText('Добавить пользователя');
 await page.locator('#accessUsers tr').filter({hasText:'team@roles.test'}).getByRole('button',{name:'Настроить'}).click();
 await expect(page.locator('[name=role]')).toHaveValue('team');await expect(page.locator('[name=projects]:checked')).toHaveCount(1);
 await page.locator('[name=projects][value="amklinika-k8m2"]').check();await page.locator('#accessForm [type=submit]').click();await expect(page.locator('#accessFormStatus')).toHaveText('Доступ сохранён.');
 await page.locator('#editor .dialog-close').click();await expect(page.locator('#accessUsers tr').filter({hasText:'team@roles.test'})).toContainText('AM Klinika');
 await page.locator('#newClient').click();await page.locator('[name=name]').fill('Новый сотрудник');await page.locator('[name=email]').fill('new-team@roles.test');await page.locator('[name=role]').selectOption('team');
 await page.locator('[name=projects][value="housevip-cxp7"]').check();await page.locator('#accessForm [type=submit]').click();await expect(page.locator('#invitationText')).toHaveValue(/activate#token=/);
 await page.locator('#editor .dialog-close').click();await page.locator('#newClient').click();await page.locator('[name=role]').selectOption('admin');await expect(page.locator('#allProjectsHint')).toBeVisible();await expect(page.locator('#accessProjectChoices')).toBeHidden();
 await page.locator('[name=role]').selectOption('team');await expect(page.locator('#accessProjectChoices')).toBeVisible();await page.screenshot({path:'dist/team-access-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#accessForm [type=submit]')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'dist/team-access-mobile.png',fullPage:true});
 await page.locator('#editor .dialog-close').click();await page.locator('[data-view=home]').click();await expect(page.locator('#projectSelect option')).toHaveCount(3);expect(errors).toEqual([]);
 // Restore the employee's scope through the mobile More menu.
 await page.locator('.master-more-nav>summary').click();await page.locator('[data-view=access]').click();await page.locator('#accessUsers tr').filter({hasText:'team@roles.test',exact:false}).filter({hasNotText:'new-team@roles.test'}).getByRole('button',{name:'Настроить'}).click();await page.locator('[name=projects][value="amklinika-k8m2"]').uncheck();await page.locator('#accessForm [type=submit]').click();await expect(page.locator('#accessFormStatus')).toHaveText('Доступ сохранён.');
});
test('team master and client invitation show only assigned projects and no role or CAPI controls',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-role':'team'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/master/');await expect(page.locator('#projectSelect option')).toHaveCount(2);await expect(page.locator('#projectSelect')).not.toContainText('AM Klinika');
 await page.locator('[data-view=crm]').click();await expect(page.locator('#connections')).toBeHidden();await expect(page.locator('#newLead')).toBeVisible();
 await page.locator('[data-view=access]').click();await expect(page.locator('#newClient')).toHaveText('Добавить клиента');await expect(page.locator('#accessUsers')).not.toContainText('Администратор TOYS');
 await page.locator('#newClient').click();await expect(page.locator('select[name=role]')).toHaveCount(0);await expect(page.locator('[name=enabled]')).toHaveCount(0);await expect(page.locator('[name=projects]')).toHaveCount(1);
 await page.locator('[name=email]').fill('team-client@roles.test');await page.locator('[name=projects]').check();await page.locator('#accessForm [type=submit]').click();await expect(page.locator('#invitationText')).toHaveValue(/activate#token=/);
 await page.locator('#editor .dialog-close').click();await page.reload();await expect(page.locator('#accessUsers')).toContainText('team-client@roles.test');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.master-more-nav>summary').click();await expect(page.locator('#accessNav')).toBeVisible();await expect(page.locator('#auditNav')).toBeHidden();await page.keyboard.press('Escape');await page.screenshot({path:'dist/team-master-mobile.png',fullPage:true});expect(errors).toEqual([]);
});
test('unassigned team can enter master and existing client keeps dashboard and CRM access only',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-role':'empty'});await page.goto('/master/');await expect(page.locator('#message')).toContainText('Проекты ещё не назначены');await page.locator('[data-view=access]').click();await page.locator('#newClient').click();await expect(page.locator('#accessProjectChoices')).toContainText('Нет доступных проектов');
 await page.setExtraHTTPHeaders({'x-test-role':'client'});await page.goto('/housevip-cxp7/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await page.getByRole('link',{name:'CRM',exact:true}).click();await expect(page.locator('#platformClientCRM')).toBeVisible();await expect(page.locator('#platformClientCRM #connections')).toBeHidden();
 const response=await page.request.get('/api/v2/master',{headers:{'x-test-role':'client'}});expect(response.status()).toBe(403);
});
test('team can open client access from the project CRM while clients cannot see the shortcut',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-role':'team'});await page.goto('/api/v2/projects/housevip-cxp7/content-crm');
 await expect(page.getByRole('link',{name:'Доступы клиентов',exact:true})).toHaveAttribute('href','/master/#access');
 await page.getByRole('link',{name:'Доступы клиентов',exact:true}).click();await expect(page.locator('#newClient')).toHaveText('Добавить клиента');
 await page.locator('#newClient').click();await expect(page.locator('#editorBody')).toContainText('только для чтения');await expect(page.locator('select[name=role]')).toHaveCount(0);
 await page.setExtraHTTPHeaders({'x-test-role':'client'});await page.goto('/api/v2/projects/housevip-cxp7/content-crm');await expect(page.getByRole('link',{name:'Доступы клиентов',exact:true})).toHaveCount(0);
});
