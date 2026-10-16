import {test,expect} from '@playwright/test';
test('add result opens a first editor and preserves draft, publication and comments',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 let initializations=0;page.on('request',r=>{if(r.url().endsWith('/weekly-main/initialize'))initializations++;});
 await page.goto('/api/v2/projects/housevip-cxp7/content-project');
 await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await page.locator('[data-ux-view=weekly]').click();await page.locator('#uxWeeklyAdd').click();
 await expect(page.locator('#weeklyForm')).toBeVisible();await expect(page.locator('#weeklyForm [name=summary]')).toBeFocused();expect(initializations).toBe(1);
 await page.locator('#weeklyForm [name=summary]').fill('Первый итог после переноса');
 await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click();await expect(page.locator('#weeklyMessage')).toContainText('Черновик сохранён');
 await page.reload();await expect(page.locator('#weeklyForm [name=summary]')).toHaveValue('Первый итог после переноса');expect(initializations).toBe(1);
 await page.getByRole('button',{name:'Сохранить и опубликовать',exact:true}).click();await expect(page.locator('#weeklyMessage')).toContainText('Отчёт опубликован');
 await page.locator('#commentForm textarea').fill('Первый комментарий');await page.getByRole('button',{name:'Добавить комментарий',exact:true}).click();await expect(page.locator('#commentsList')).toContainText('Первый комментарий');
 await page.setExtraHTTPHeaders({'x-test-viewer':'true'});await page.reload();await expect(page.locator('#weeklyForm')).toHaveCount(0);await expect(page.locator('#weeklyContent')).toContainText('Первый итог после переноса');expect(initializations).toBe(1);
});
