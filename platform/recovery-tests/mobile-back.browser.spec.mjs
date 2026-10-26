import {test,expect} from '@playwright/test';
import {selectNovaSection} from './nova-browser-helpers.mjs';
const portal='/api/v2/projects/housevip-cxp7/content-project';
async function start(page,path=portal){await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));await page.setViewportSize({width:390,height:844});await page.goto(path);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');}
test('mobile back follows cabinet sections in order and stays hidden on desktop',async({page})=>{
 await start(page);const back=page.locator('#platformMobileBack');await expect(back).toBeDisabled();
 for(const view of ['campaigns','funnel','weekly'])await selectNovaSection(page,view);
 for(const label of ['Воронка','Кампании','Обзор']){await back.click();await expect(page.locator('#novaSectionToggle')).toHaveText(label);}
 await expect(back).toBeDisabled();await page.setViewportSize({width:1440,height:900});await expect(back).toBeHidden();
});
test('mobile back returns from CRM to the same cabinet section',async({page})=>{
 await start(page);await selectNovaSection(page,'weekly');await page.locator('#platformCRMNav').click();await expect(page.locator('body')).toHaveClass(/platform-show-crm/);
 await expect(page.locator('#platformMobileBack')).toBeVisible();await page.locator('#platformMobileBack').click();await expect(page.locator('body')).not.toHaveClass(/platform-show-crm/);await expect(page.locator('#novaSectionToggle')).toHaveText('Итоги и комментарии');await expect(page.locator('#weeklySearch')).toBeVisible();
});
test('deep-linked CRM and sections return to overview without leaving the cabinet',async({page})=>{
 await start(page,portal+'#funnel');await page.locator('#platformMobileBack').click();await expect(page.locator('#novaSectionToggle')).toHaveText('Обзор');
 await start(page,'/api/v2/projects/housevip-cxp7/content-crm');await expect(page.locator('body')).toHaveClass(/platform-show-crm/);await page.locator('#platformMobileBack').click();await expect(page.locator('body')).not.toHaveClass(/platform-show-crm/);await expect(page.locator('#novaSectionToggle')).toHaveText('Обзор');
});
test('mobile master back follows its sections and handles a direct link',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/master/#access');const back=page.locator('#masterMobileBack');await expect(back).toBeVisible();
 await back.click();await expect(page.locator('#heading')).toHaveText('Все проекты');
 await page.locator('.master-more-nav summary').click();await page.locator('.master-more-panel [data-view=access]').click();await expect(page.locator('#heading')).toHaveText('Доступы');
 await page.locator('.master-more-nav summary').click();await page.locator('.master-more-panel [data-view=reviews]').click();await back.click();await expect(page.locator('#heading')).toHaveText('Доступы');await back.click();await expect(page.locator('#heading')).toHaveText('Все проекты');
 await page.screenshot({path:'dist/mobile-master-back.png',animations:'disabled'});
});
test('mobile back unwinds campaign levels before leaving campaigns',async({page})=>{
 const key=n=>String(n).padStart(64,'0'),row=(n,level)=>({key:key(n),name:level,level,childCount:level==='ad'?0:1,provider:'meta_ads',currency:'EUR',metrics:{}});
 await page.route('**/campaign-browser?*',route=>{const parent=new URL(route.request().url()).searchParams.get('parent');const current=parent===key(2)?row(3,'ad'):parent===key(1)?row(2,'group'):row(1,'campaign');return route.fulfill({json:{ok:true,rows:[current],total:1,nextOffset:null,sources:[]}});});
 await start(page);await selectNovaSection(page,'campaigns');await page.locator('[data-action=open]').click();await page.locator('[data-action=open]').click();await expect(page.locator('.campaign-entity[data-level=ad]')).toHaveCount(1);
 await page.locator('#platformMobileBack').click();await expect(page.locator('.campaign-entity[data-level=group]')).toHaveCount(1);await expect(page.locator('#novaSectionToggle')).toHaveText('Кампании');
 await page.locator('#platformMobileBack').click();await expect(page.locator('.campaign-entity[data-level=campaign]')).toHaveCount(1);
 await page.locator('#platformMobileBack').click();await expect(page.locator('#novaSectionToggle')).toHaveText('Обзор');
});
test('mobile back restores the previous project channel',async({page})=>{
 await start(page);await selectNovaSection(page,'project');const smm=page.locator('#uxProjectChannels [data-legacy-view=smm],#uxProjectChannels [data-channel=smm]').first();await smm.click();
 await selectNovaSection(page,'weekly');await page.locator('#platformMobileBack').click();await expect(page.locator('#novaSectionToggle')).toHaveText('Проект');await expect(smm).toHaveClass(/active/);
 await page.screenshot({path:'dist/mobile-cabinet-back.png',animations:'disabled'});
});
test('master back respects unsaved invoice confirmation and keeps its return target after cancellation',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/master/#documents?project=housevip-cxp7');await page.locator('[data-doc-new]').first().click();await page.locator('[name=issuer]').fill('Несохранённый инвойс');
 await page.setViewportSize({width:390,height:844});page.once('dialog',d=>d.dismiss());await page.locator('#masterMobileBack').click();await expect(page.locator('[name=issuer]')).toHaveValue('Несохранённый инвойс');await expect(page.locator('#heading')).toHaveText('Документация');
 page.once('dialog',d=>d.accept());await page.locator('#masterMobileBack').click();await expect(page.locator('#heading')).toHaveText('Все проекты');
});
