import {test,expect} from '@playwright/test';
async function checkViewer(page,selector,{mobile=false}={}){
 const trigger=page.locator(selector).first(),dialog=page.locator('#reportImageViewer'),url=page.url(),tabs=page.context().pages().length;
 await trigger.click();await expect(dialog).toBeVisible();await expect(dialog.locator('[data-image-close]')).toBeFocused();
 await expect(dialog.locator('img')).toBeVisible();await expect(dialog.locator('[data-image-counter]')).toHaveText('1 / 2');
 await expect(dialog.locator('[data-image-prev]')).toBeDisabled();expect(page.url()).toBe(url);expect(page.context().pages()).toHaveLength(tabs);
 const fit=await dialog.locator('img').boundingBox(),stage=await dialog.locator('.report-image-stage').boundingBox();expect(fit.width).toBeLessThanOrEqual(stage.width);expect(fit.height).toBeLessThanOrEqual(stage.height);
 await dialog.locator('[data-image-zoom]').click();await expect(dialog.locator('[data-image-zoom]')).toHaveAttribute('aria-pressed','true');
 await dialog.locator('[data-image-next]').click();await expect(dialog.locator('[data-image-counter]')).toHaveText('2 / 2');await expect(dialog.locator('[data-image-next]')).toBeDisabled();await expect(dialog.locator('[data-image-zoom]')).toHaveAttribute('aria-pressed','false');
 await page.keyboard.press('ArrowLeft');await expect(dialog.locator('[data-image-counter]')).toHaveText('1 / 2');
 await expect(dialog.locator('img')).toBeVisible();await page.screenshot({path:`dist/report-popup-${mobile?'mobile':'desktop'}.png`});
 // Native dialog keeps keyboard focus in the popup.
 for(let i=0;i<6;i++){await page.keyboard.press('Tab');expect(await dialog.evaluate(d=>d.contains(document.activeElement))).toBe(true);}
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
 await trigger.click();await page.mouse.click(1,1);await expect(dialog).not.toBeVisible();
 await trigger.click();await dialog.locator('[data-image-close]').click();await expect(dialog).not.toBeVisible();expect(page.url()).toBe(url);expect(page.context().pages()).toHaveLength(tabs);
}
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
 const shots=await page.evaluate(()=>[0,1].map(i=>{const c=document.createElement('canvas');c.width=i?1600:1200;c.height=i?900:1600;const x=c.getContext('2d');x.fillStyle='#0c1514';x.fillRect(0,0,c.width,c.height);x.fillStyle='#26ddcc';x.fillRect(80,180,c.width-160,6);x.font='bold 72px sans-serif';x.fillText('TOYS / '+(i?'Google Ads':'Meta Ads'),80,130);x.fillStyle='white';x.font='48px sans-serif';x.fillText('Campaign report',80,300);x.fillText('Leads: 128',80,420);x.fillText('CTR: 4.8%',80,520);return c.toDataURL('image/png').split(',')[1];}));
 await page.locator('#reportScreenshotInput').setInputFiles(shots.map((b,i)=>({name:`test-${i}.png`,mimeType:'image/png',buffer:Buffer.from(b,'base64')})));
 await expect(page.locator('#reportScreenshots img')).toHaveCount(2);await expect(page.locator('#screenshotMessage')).toContainText('Скриншоты загружены');
 await checkViewer(page,'#reportScreenshots [data-report-screenshot]');await expect(page.locator('#weeklyForm [name=summary]')).toHaveValue('Первый итог после переноса');
 await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click();await expect(page.locator('#weeklyMessage')).toContainText('Черновик сохранён');
 await page.reload();await expect(page.locator('#weeklyForm')).toHaveCount(0);await page.locator('[data-weekly-draft] summary').click();await page.getByRole('button',{name:'Продолжить редактирование',exact:true}).click();await expect(page.locator('#weeklyForm [name=summary]')).toHaveValue('Первый итог после переноса');expect(initializations).toBe(1);await expect(page.locator('#weeklyForm [name=channel]')).toHaveValue('google');await expect(page.locator('#reportScreenshots img')).toHaveCount(2);
 await page.getByRole('button',{name:'Сохранить и опубликовать',exact:true}).click();await expect(page.locator('#weeklyMessage')).toContainText('Отчёт опубликован');
 await expect(page.locator('#weeklyForm')).toHaveCount(0);await expect(page.locator('[data-weekly-published]')).not.toHaveAttribute('open','');
 await page.reload();await expect(page.locator('#weeklyForm')).toHaveCount(0);await expect(page.locator('[data-weekly-published]')).not.toHaveAttribute('open','');
 await page.locator('[data-weekly-published] summary').click();await expect(page.locator('#weeklyContent .report-screenshots img').first()).toBeVisible();await page.getByRole('button',{name:'Редактировать',exact:true}).click();await expect(page.locator('#weeklyForm [name=summary]')).toHaveValue('Первый итог после переноса');
 await page.locator('#commentForm textarea').fill('Первый комментарий');await page.getByRole('button',{name:'Добавить комментарий',exact:true}).click();await expect(page.locator('#commentsList')).toContainText('Первый комментарий');
 await page.getByRole('button',{name:'История',exact:true}).click();await page.locator('#historyContent [data-revision]').first().click();await page.locator('#historyContent [data-report-screenshot]').first().click();await expect(page.locator('#reportImageViewer img')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#history')).toBeVisible();await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await page.setExtraHTTPHeaders({'x-test-viewer':'true'});await page.reload();await expect(page.locator('#weeklyForm')).toHaveCount(0);await expect(page.locator('#weeklyContent')).toContainText('Первый итог после переноса');expect(initializations).toBe(1);await expect(page.locator('[data-weekly-published]')).not.toHaveAttribute('open','');await page.locator('[data-weekly-published] summary').click();await expect(page.locator('#weeklyContent .report-channel')).toHaveText('Google Ads');await expect(page.locator('#weeklyContent .report-screenshots img')).toHaveCount(2);await expect.poll(()=>page.locator('#weeklyContent .report-screenshots img').first().evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await checkViewer(page,'#weeklyContent [data-report-screenshot]');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await checkViewer(page,'#weeklyContent [data-report-screenshot]',{mobile:true});
 await page.route('**/attachments/*',r=>r.fulfill({status:503,body:'unavailable'}));await page.locator('#weeklyContent [data-report-screenshot] img').first().evaluate(img=>img.src+='?qa=failed');await page.locator('#weeklyContent [data-report-screenshot]').first().click();await expect(page.locator('#reportImageViewer .report-image-status')).toContainText('Не удалось загрузить');await page.keyboard.press('Escape');await page.unroute('**/attachments/*');await page.locator('#weeklyContent [data-report-screenshot] img').first().evaluate(img=>img.src=img.src.split('?')[0]+'?qa=recovered');await page.locator('#weeklyContent [data-report-screenshot]').first().click();await expect(page.locator('#reportImageViewer img')).toBeVisible();await page.keyboard.press('Escape');
});
