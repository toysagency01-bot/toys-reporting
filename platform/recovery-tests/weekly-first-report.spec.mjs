import {test,expect} from '@playwright/test';

test('mobile editor has a back button and protects unsaved report text',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));await page.setViewportSize({width:390,height:844});
 await page.goto('/api/v2/projects/housevip-cxp7/content-project#weekly');await page.locator('#uxWeeklyAdd').click();
 const back=page.locator('#platformMobileBack');await expect(back).toBeVisible();
 await back.click();await expect(page.locator('#weeklyForm')).toHaveCount(0);await expect(page.locator('#weeklySearch')).toBeVisible();
 await page.locator('#uxWeeklyAdd').click();await page.locator('#weeklyForm [name=summary]').fill('Несохранённый текст');
 page.once('dialog',d=>d.dismiss());await back.click();await expect(page.locator('#weeklyForm [name=summary]')).toHaveValue('Несохранённый текст');
 await page.locator('#weeklyForm').evaluate(f=>f.dataset.busy='true');await back.click();await expect(page.locator('#weeklyForm')).toBeVisible();await page.locator('#weeklyForm').evaluate(f=>delete f.dataset.busy);
 page.once('dialog',d=>d.accept());await back.click();await expect(page.locator('#weeklyForm')).toHaveCount(0);await expect(page.locator('#weeklySearch')).toBeVisible();
});

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
 let initializations=0;page.on('request',r=>{if(r.url().endsWith('/initialize'))initializations++;});
 await page.goto('/api/v2/projects/housevip-cxp7/content-project');
 await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await page.locator('[data-ux-view=weekly]').click();await page.locator('#uxWeeklyAdd').click();
 await expect(page.locator('#weeklyForm')).toBeVisible();await expect(page.locator('#weeklyForm [name=summary]')).toBeFocused();expect(initializations).toBe(0);
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

test('report deletion is admin-only, confirmed, durable and allows adding a new report',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 const base='/api/v2/projects/housevip-cxp7',origin='http://127.0.0.1:4173';
 await page.request.post(base+'/content/weekly-main/initialize',{headers:{origin},data:{}});
 const history=await(await page.request.get(base+'/content/weekly-main/revisions')).json();
 const saved=await page.request.post(base+'/content/weekly-main/save-and-publish',{headers:{origin,'x-idempotency-key':'browser-delete-report-fixture'},data:{expectedRevision:history.item.latestRevision,expectedPublishedRevisionId:history.item.publishedRevisionId,blocks:[{type:'period_summary',blockKey:'summary',payload:{periodStart:'2026-10-07',periodEnd:'2026-10-13',summary:'Отчёт для проверки удаления',channel:'meta'}}]}});expect(saved.ok()).toBe(true);
 await page.setExtraHTTPHeaders({'x-test-viewer':'true'});await page.goto(base+'/content-project#weekly');await expect(page.locator('[data-weekly-published][data-report-key="weekly-main"]')).toBeVisible();await page.locator('[data-weekly-published][data-report-key="weekly-main"] summary').click();await expect(page.locator('[data-delete-weekly="weekly-main"]')).toHaveCount(0);
 const denied=await page.request.post(base+'/content/weekly-main/delete',{headers:{origin,'x-test-viewer':'true'},data:{id:history.item.id,expectedRevision:history.item.latestRevision+1,expectedPublishedRevisionId:(await saved.json()).revision.id}});expect(denied.status()).toBe(403);
 await page.setExtraHTTPHeaders({});await page.reload();await page.locator('[data-weekly-published][data-report-key="weekly-main"] summary').click();await page.locator('[data-weekly-published][data-report-key="weekly-main"] [data-report-menu]').click();await expect(page.locator('[data-delete-weekly="weekly-main"]')).toBeVisible();
 let deletes=0;page.on('request',r=>{if(r.url().endsWith('/weekly-main/delete')&&r.method()==='POST')deletes++;});
 page.once('dialog',d=>d.dismiss());await page.locator('[data-delete-weekly="weekly-main"]').click();expect(deletes).toBe(0);await expect(page.locator('[data-weekly-published][data-report-key="weekly-main"]')).toContainText('Отчёт для проверки удаления');
 await page.route('**/weekly-main/delete',r=>r.fulfill({status:403,json:{ok:false,error:'admin_role_required'}}));page.once('dialog',d=>d.accept());await page.locator('[data-delete-weekly="weekly-main"]').click();await expect(page.locator('#weeklyMessage')).toContainText('только администратор');await expect(page.locator('[data-weekly-published][data-report-key="weekly-main"]')).toBeVisible();await page.unroute('**/weekly-main/delete');
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Редактировать',exact:true}).click();await expect(page.locator('#weeklyForm [data-delete-weekly]')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#weeklyForm [data-delete-weekly]').scrollIntoViewIfNeeded();await page.screenshot({path:'dist/report-delete-mobile.png'});
 page.once('dialog',d=>d.accept());await page.locator('#weeklyForm [data-delete-weekly]').click();await expect(page.locator('#weeklyMessage')).toContainText('Отчёт удалён');await expect(page.locator('[data-weekly-published][data-report-key="weekly-main"]')).toHaveCount(0);
 await page.reload();await expect(page.locator('[data-report-key="weekly-main"]')).toHaveCount(0);await page.locator('#uxWeeklyAdd').click();await expect(page.locator('#weeklyForm [name=summary]')).toHaveValue('');
 await page.locator('#weeklyForm [name=channel]').selectOption('smm');await page.locator('#weeklyForm [name=summary]').fill('Новый отчёт после удаления');await page.getByRole('button',{name:'Сохранить и опубликовать',exact:true}).click();await expect(page.locator('#weeklyMessage')).toContainText('Отчёт опубликован');await expect(page.locator('[data-weekly-published]').filter({hasText:'Новый отчёт после удаления'})).toHaveCount(1);
});

test('expanded reports show full multiline text and omit empty sections on desktop and mobile',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 const base='/api/v2/projects/housevip-cxp7',origin='http://127.0.0.1:4173';
 const summary='За отчётный месяц получили 644 лида при средней стоимости 144 Kč. '+('Кампанию перезапустили с новыми креативами и проверили результаты. '.repeat(9))+'\n\nСледующий абзац: '+('длиннаяссылка'.repeat(25))+'\nПоследняя строка отчёта.';
 const payload={periodStart:'2026-09-15',periodEnd:'2026-10-15',channel:'meta',summary,wins:'',issues:'   \n ',changes:'—',nextSteps:'Продолжаем проверку новых креативов.\nСверяем качество лидов.'};
 await page.request.post(base+'/content/weekly-main/initialize',{headers:{origin},data:{}});
 const history=await(await page.request.get(base+'/content/weekly-main/revisions')).json();
 const saved=await page.request.post(base+'/content/weekly-main/save-and-publish',{headers:{origin,'x-idempotency-key':'browser-complete-report-text'},data:{expectedRevision:history.item.latestRevision,expectedPublishedRevisionId:history.item.publishedRevisionId,blocks:[{type:'period_summary',blockKey:'summary',payload}]}});expect(saved.ok()).toBe(true);
 await page.route('**/weekly-reports',r=>r.fulfill({json:{ok:true,canDelete:true,reports:[{...payload,id:'archive-display-qa',updatedAt:'2026-10-16'}]}}));
 await page.goto(base+'/content-project#weekly');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await page.locator('[data-ux-view=weekly]').click();
 const report=page.locator('[data-weekly-published][data-report-key="weekly-main"]'),archive=page.locator('#weeklyArchive details');
 await expect(report).toBeVisible();await report.locator('summary').click();await archive.locator('summary').click();
 for(const row of [report,archive]){
  await expect(row.locator('.report-summary-text')).toHaveText(summary);
  await expect(row.locator('.report-field')).toHaveCount(1);
  await expect(row.locator('.report-field h3')).toHaveText('План на следующую неделю');
 }
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  for(const row of [report,archive]){
   const measure=await row.locator('.report-summary-text').evaluate(el=>({height:el.clientHeight,full:el.scrollHeight,width:el.clientWidth,scrollWidth:el.scrollWidth,whiteSpace:getComputedStyle(el).whiteSpace}));
   expect(measure.height).toBeGreaterThan(40);expect(measure.full).toBeLessThanOrEqual(measure.height+1);expect(measure.scrollWidth).toBeLessThanOrEqual(measure.width+1);expect(measure.whiteSpace).toBe('pre-wrap');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`dist/report-full-text-${width}.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'Включить светлую тему',exact:true}).click();
 await page.screenshot({path:'dist/report-full-text-light-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'dist/report-full-text-light-desktop.png',fullPage:true});
 await report.getByRole('button',{name:'Редактировать',exact:true}).click();
 await expect(page.locator('#weeklyForm [name=summary]')).toHaveValue(summary);
 for(const key of ['wins','issues','changes','nextSteps'])await expect(page.locator(`#weeklyForm [name=${key}]`)).toBeVisible();
 await page.getByRole('button',{name:'История',exact:true}).click();await page.locator('#historyContent [data-revision]').first().click();
 await expect(page.locator('#historyContent .report-field')).toHaveCount(2);await expect(page.locator('#historyContent .report-field').first()).toContainText('Последняя строка отчёта.');
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await page.setExtraHTTPHeaders({'x-test-viewer':'true'});await page.reload();await report.locator('summary').click();
 await expect(report.locator('.report-summary-text')).toHaveText(summary);await expect(report.locator('.report-field')).toHaveCount(1);await expect(report.locator('[data-edit-weekly]')).toHaveCount(0);
});

test('adding SMM and Google creates separate reports; editing and deleting SMM preserve Meta',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 await page.goto('/api/v2/projects/housevip-cxp7/content-project#weekly');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await page.locator('[data-ux-view=weekly]').click();
 const card=text=>page.locator('[data-weekly-published]').filter({hasText:text});
 async function add(channel,text){
  await page.locator('#uxWeeklyAdd').click();await expect(page.locator('#weeklyForm [name=summary]')).toHaveValue('');await expect(page.locator('#weeklyForm [name=channel]')).toHaveValue('');await expect(page.locator('#reportScreenshots img')).toHaveCount(0);
  await page.locator('#weeklyForm [name=channel]').selectOption(channel);await page.locator('#weeklyForm [name=summary]').fill(text);
  await page.locator('#weeklyForm [name=periodStart]').fill('2026-10-01');await page.locator('#weeklyForm [name=periodEnd]').fill('2026-10-13');
 }
 async function publish(){await page.getByRole('button',{name:'Сохранить и опубликовать',exact:true}).click();await expect(page.locator('#weeklyMessage')).toContainText('Отчёт опубликован');}
 await add('meta','META: этот отчёт должен сохраниться');await publish();const metaKey=await card('META: этот отчёт должен сохраниться').getAttribute('data-report-key');
 await add('smm','SMM: отдельный отчёт');
 await page.locator('#reportScreenshotInput').setInputFiles({name:'smm.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5VQAAAAASUVORK5CYII=','base64')});await expect(page.locator('#screenshotMessage')).toContainText('Скриншоты загружены');
 await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click();await expect(page.locator('#weeklyMessage')).toContainText('Черновик сохранён');
 await page.locator('#commentForm textarea').fill('Комментарий только для SMM');await page.getByRole('button',{name:'Добавить комментарий',exact:true}).click();await expect(page.locator('#commentsList')).toContainText('Комментарий только для SMM');
 await page.setExtraHTTPHeaders({'x-test-viewer':'true'});await page.reload();await expect(card('META: этот отчёт должен сохраниться')).toHaveCount(1);await expect(page.locator('#weeklyContent')).not.toContainText('SMM: отдельный отчёт');
 await page.setExtraHTTPHeaders({});await page.reload();const draft=page.locator('[data-weekly-draft]').filter({hasText:'SMM: отдельный отчёт'});await draft.locator('summary').click();await draft.locator('[data-edit-weekly]').click();await publish();
 const smmKey=await card('SMM: отдельный отчёт').getAttribute('data-report-key');expect(smmKey).not.toBe(metaKey);
 await add('google','GOOGLE: независимый отчёт');await publish();
 await card('SMM: отдельный отчёт').locator('summary').click();await card('SMM: отдельный отчёт').locator('[data-edit-weekly]').click();await page.locator('#weeklyForm [name=summary]').fill('SMM: обновлён только этот отчёт');await publish();
 await expect(card('META: этот отчёт должен сохраниться')).toHaveCount(1);await expect(card('GOOGLE: независимый отчёт')).toHaveCount(1);
 await page.setExtraHTTPHeaders({'x-test-viewer':'true'});await page.reload();await card('SMM: обновлён только этот отчёт').locator('summary').click();await card('SMM: обновлён только этот отчёт').locator('[data-report-screenshot]').click();await expect(page.locator('#reportImageViewer img')).toBeVisible();await page.keyboard.press('Escape');
 await page.setExtraHTTPHeaders({});await page.reload();await card('META: этот отчёт должен сохраниться').locator('summary').click();await card('META: этот отчёт должен сохраниться').locator('[data-edit-weekly]').click();await expect(page.locator('#commentsList')).toContainText('Комментариев пока нет');await page.locator('#closeWeeklyEditor').click();
 await page.setViewportSize({width:390,height:844});await card('SMM: обновлён только этот отчёт').locator('summary').click();await card('SMM: обновлён только этот отчёт').locator('[data-report-menu]').click();page.once('dialog',d=>d.accept());await card('SMM: обновлён только этот отчёт').locator('[data-delete-weekly]').click();await expect(page.locator('#weeklyMessage')).toContainText('Отчёт удалён');
 await page.reload();await expect(page.locator(`[data-report-key="${smmKey}"]`)).toHaveCount(0);await expect(card('META: этот отчёт должен сохраниться')).toHaveCount(1);await expect(card('GOOGLE: независимый отчёт')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'dist/independent-reports-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'dist/independent-reports-desktop.png',fullPage:true});
});
