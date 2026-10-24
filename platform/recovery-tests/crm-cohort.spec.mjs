import {test,expect} from '@playwright/test';
const intake='2026-10-07',event='2026-10-14';
const count=page=>page.locator('#platformCRMStats .card').filter({has:page.locator('.label',{hasText:'Квал-лиды CRM'})}).locator('.value');
async function period(page,date){await page.locator('#platformCalendar').click();const day=page.locator(`[data-date="${date}"]`);await day.click();await day.click();await page.getByRole('button',{name:'Применить',exact:true}).click();await expect(page.locator('#dateFrom')).toHaveValue(date);await expect(page.locator('#dateTo')).toHaveValue(date);}
test('dashboard and master attribute a later qualification to intake, without method clutter and with cached reloads',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));await page.setViewportSize({width:1440,height:960});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/api/v2/projects/housevip-cxp7/content-project');await period(page,intake);await expect(count(page)).toHaveText('1');await expect(page.locator('#platformCRMMethod,#platformCRMDateBasis')).toHaveCount(0);
 await page.screenshot({path:'/tmp/crm-cohort-desktop.png'});await period(page,event);await expect(count(page)).toHaveText('0');
 await period(page,intake);await expect(count(page)).toHaveText('1');await page.reload();await expect(count(page)).toHaveText('1');
 await page.goto('/master/');await period(page,intake);await expect(page.locator('#metrics .card').filter({has:page.locator('.label',{hasText:'Квал-лиды CRM'})}).locator('.value')).toHaveText('1');await expect(page.locator('#masterCRMBasis')).toHaveCount(0);
 await period(page,event);await expect(page.locator('#metrics .card').filter({has:page.locator('.label',{hasText:'Квал-лиды CRM'})}).locator('.value')).toHaveText('0');expect(errors).toEqual([]);
});
test('mobile dashboard reports the same cohort and retains usable period controls',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));await page.setViewportSize({width:390,height:844});await page.goto('/api/v2/projects/housevip-cxp7/content-project');
 await period(page,intake);await expect(count(page)).toHaveText('1');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('#platformCRMMethod,#platformCRMDateBasis')).toHaveCount(0);await page.screenshot({path:'/tmp/crm-cohort-mobile.png'});await period(page,event);await expect(count(page)).toHaveText('0');
});
