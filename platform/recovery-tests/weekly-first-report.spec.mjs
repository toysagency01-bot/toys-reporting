import {test,expect} from '@playwright/test';
test('add result opens a first editor and preserves draft, publication and comments',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 // Public material responses omit internal revision ids, even for a signed-in editor.
 await page.route('**/content?logicalKey=weekly-main',async route=>{const response=await route.fetch(),body=await response.json();if(body.publishedRevision)delete body.publishedRevision.id;await route.fulfill({response,json:body});});
 let initializations=0;page.on('request',r=>{if(r.url().endsWith('/weekly-main/initialize'))initializations++;});
 await page.goto('/api/v2/projects/housevip-cxp7/content-project');
 await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await page.locator('[data-ux-view=weekly]').click();await page.locator('#uxWeeklyAdd').click();
 await expect(page.locator('#weeklyForm')).toBeVisible();await expect(page.locator('#weeklyForm [name=summary]')).toBeFocused();expect(initializations).toBe(1);
 await page.locator('#weeklyForm [name=channel]').selectOption('google');
 await page.locator('#weeklyForm [name=summary]').fill('Первый итог после переноса');
 await expect(page.locator('#reportScreenshotInput')).toBeEnabled();
 await page.locator('#reportScreenshotInput').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5VQAAAAASUVORK5CYII=','base64')});
 await expect(page.locator('#reportScreenshots img')).toHaveCount(1);await expect(page.locator('#screenshotMessage')).toContainText('Скриншоты загружены');
 await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click();await expect(page.locator('#weeklyMessage')).toContainText('Черновик сохранён');
 await page.reload();await expect(page.locator('#weeklyForm')).toHaveCount(0);await page.locator('[data-weekly-draft] summary').click();await page.getByRole('button',{name:'Продолжить редактирование',exact:true}).click();await expect(page.locator('#weeklyForm [name=summary]')).toHaveValue('Первый итог после переноса');expect(initializations).toBe(1);await expect(page.locator('#weeklyForm [name=channel]')).toHaveValue('google');await expect(page.locator('#reportScreenshots img')).toHaveCount(1);
 await page.getByRole('button',{name:'Сохранить и опубликовать',exact:true}).click();await expect(page.locator('#weeklyMessage')).toContainText('Отчёт опубликован');
 await expect(page.locator('#weeklyForm')).toHaveCount(0);await expect(page.locator('[data-weekly-published]')).not.toHaveAttribute('open','');
 await page.reload();await expect(page.locator('#weeklyForm')).toHaveCount(0);await expect(page.locator('[data-weekly-published]')).not.toHaveAttribute('open','');
 await page.locator('[data-weekly-published] summary').click();await expect(page.locator('#weeklyContent .report-screenshots img')).toBeVisible();await page.getByRole('button',{name:'Редактировать',exact:true}).click();await expect(page.locator('#weeklyForm [name=summary]')).toHaveValue('Первый итог после переноса');
 await page.locator('#commentForm textarea').fill('Первый комментарий');await page.getByRole('button',{name:'Добавить комментарий',exact:true}).click();await expect(page.locator('#commentsList')).toContainText('Первый комментарий');
 await page.setExtraHTTPHeaders({'x-test-viewer':'true'});await page.reload();await expect(page.locator('#weeklyForm')).toHaveCount(0);await expect(page.locator('#weeklyContent')).toContainText('Первый итог после переноса');expect(initializations).toBe(1);await expect(page.locator('[data-weekly-published]')).not.toHaveAttribute('open','');await page.locator('[data-weekly-published] summary').click();await expect(page.locator('#weeklyContent .report-channel')).toHaveText('Google Ads');await expect(page.locator('#weeklyContent .report-screenshots img')).toHaveCount(1);await expect.poll(()=>page.locator('#weeklyContent .report-screenshots img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'dist/weekly-accordion-mobile.png',fullPage:true});
});
