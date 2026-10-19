import {test,expect} from '@playwright/test';

test('administrator can open the kanban and create a lead on desktop and mobile without reloading the dashboard',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/housevip-cxp7/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await page.locator('#platformCRMNav').click();const crm=page.locator('#platformClientCRM');await expect(crm).toBeVisible();
 await crm.locator('#newLead').click();await expect(crm.locator('#editor')).toBeVisible();
 await crm.locator('#editor input[name=name]').fill('Проверка интеграции');await crm.locator('#editor input[name=phone]').fill('+420123456789');
 await crm.locator('#editor button[type=submit]').click();await expect(crm.locator('#editor')).not.toBeVisible();
 await expect(crm).toContainText('Проверка интеграции');
 await page.screenshot({path:'dist/admin-crm-desktop.png'});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#platformCRMNav')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'dist/admin-crm-mobile.png'});
 await page.locator('#platformHomeNav').click();await expect(crm).toBeHidden();await page.locator('#platformCRMNav').click();await expect(crm).toContainText('Проверка интеграции');expect(errors).toEqual([]);
});
test('assigned team and client cannot see or open the restricted CRM; the dashboard remains available',async({page})=>{
 for(const role of ['team','client']){
  await page.setExtraHTTPHeaders({'x-test-role':role});await page.goto('/housevip-cxp7/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
  await expect(page.locator('#platformCRMNav')).toHaveCount(0);await expect(page.locator('#platformClientCRM')).toHaveCount(0);
  expect((await page.request.get('/api/v2/projects/housevip-cxp7/crm',{headers:{'x-test-role':role}})).status()).toBe(403);
 }
 await page.setExtraHTTPHeaders({'x-test-role':'team'});await page.goto('/master/#crm');await expect(page.locator('#message')).toContainText('только администраторам');await expect(page.locator('#newLead')).toBeHidden();
 await page.locator('[data-view=home]').click();await expect(page.locator('#projectsTable')).toContainText('CRM · только администраторы');
});
