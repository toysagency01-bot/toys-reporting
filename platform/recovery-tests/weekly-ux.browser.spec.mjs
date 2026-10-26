import {test,expect} from '@playwright/test';
import {selectNovaSection} from './nova-browser-helpers.mjs';

async function reports(page,{viewer=false,draft=false}={}){
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 if(viewer)await page.setExtraHTTPHeaders({'x-test-viewer':'true'});
 let reads=0;
 const payload=(channel,older=false)=>({channel,periodStart:older?'2026-10-05':'2026-10-12',periodEnd:older?'2026-10-11':'2026-10-18',summary:channel==='meta'?'Получили 122 обращения. Квалифицированы 77 лидов, состоялась 21 продажа.\nПроверили качество обращений по каждой кампании.':'Получили 50 обращений, 31 квалификацию и 7 продаж. Расход — 814,57 $.',wins:'Обновлённые объявления привели больше целевых обращений. Стоимость квалификации снизилась.',issues:'Уточнить сроки первого ответа на обращения. Часть клиентов принимает решение дольше недели.',changes:'Разделили рекламные кампании по услугам и проверили соответствие объявлений посадочным страницам.',nextSteps:'Проверить новую подачу консультации. Сопоставить качество обращений по кампаниям.'});
 const entries=['meta','google'].flatMap(channel=>[false,true].map(older=>{const logicalKey='weekly-'+channel+(older?'-older':''),p=payload(channel,older),revision={id:logicalKey+'-1',revisionNumber:1,blocks:[{type:'period_summary',payload:p}]};return {logicalKey,publishedRevision:revision,latestRevision:draft&&channel==='meta'&&!older?{...revision,revisionNumber:2,blocks:[{type:'period_summary',payload:{...p,summary:'Черновик нового итога'}}]}:revision,item:{id:logicalKey,latestRevision:draft?2:1,publishedRevisionId:revision.id}};}));
 await page.route('**/content/reports',route=>{reads++;return route.fulfill({json:{ok:true,reports:entries,canEdit:!viewer,canDelete:!viewer}});});
 await page.route('**/weekly-reports',route=>{reads++;return route.fulfill({json:{ok:true,canDelete:!viewer,reports:[{...payload('smm',true),id:'archive-1',periodStart:'2026-09-28',periodEnd:'2026-10-04',summary:'Архивный отчёт по контенту',wins:'',issues:'',changes:'',nextSteps:''}]}});});
 await page.goto('/api/v2/projects/housevip-cxp7/content-project');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 return {reads:()=>reads};
}
for(const theme of ['dark','light'])test(`reports group channels by week with neutral section accents in ${theme}`,async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await reports(page);
 if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#toysThemeToggle').click();await page.locator('[data-ux-view=weekly]').click();
 await expect(page.locator('#weeklyContent .report-week')).toHaveCount(2);await expect(page.locator('#weeklyContent .report-week').first().locator('.weekly-report')).toHaveCount(2);await expect(page.locator('#weeklyContent .report-week-title').first()).toContainText('12–18 октября');
 const report=page.locator('[data-report-key=weekly-meta][data-weekly-published]');await report.locator('summary').click();await expect(report.locator('.report-field')).toHaveCount(4);
 const styles=await report.locator('.report-field').evaluateAll(fields=>fields.map(f=>({bg:getComputedStyle(f).backgroundColor,image:getComputedStyle(f).backgroundImage,ink:getComputedStyle(f.querySelector('h3')).borderLeftColor})));
 expect(styles.every(s=>s.bg==='rgba(0, 0, 0, 0)'&&s.image==='none')).toBe(true);expect(new Set(styles.map(s=>s.ink)).size).toBe(4);
 expect(await report.locator('.report-summary-text').evaluate(e=>e.clientHeight>=e.scrollHeight-1)).toBe(true);
 await page.screenshot({path:`dist/weekly-ux-${theme}.png`,fullPage:true});
});
test('report search and channel filter include closed sections and archives without requests or lost expansion',async({page})=>{
 const f=await reports(page);await page.locator('[data-ux-view=weekly]').click();await expect(page.locator('#weeklyReportCount')).toHaveText('Отчётов: 5');const reads=f.reads();
 const report=page.locator('[data-report-key=weekly-meta][data-weekly-published]');await report.locator('summary').click();
 await page.locator('#weeklySearch').fill('Уточнить сроки');await expect(page.locator('.weekly-report:visible')).toHaveCount(4);
 await page.locator('#weeklyChannel').selectOption('google');await expect(page.locator('.weekly-report:visible')).toHaveCount(2);
 await page.locator('#weeklySearch').fill('Несуществующий текст');await expect(page.locator('#weeklyFilterEmpty')).toBeVisible();
 await page.locator('#weeklyChannel').selectOption('');await page.locator('#weeklySearch').fill('Архивный');await expect(page.locator('.weekly-report:visible')).toHaveCount(1);await expect(page.locator('#weeklyArchive .weekly-report:visible')).toHaveCount(1);
 await page.locator('#weeklySearch').fill('');await expect(report).toHaveAttribute('open','');await page.locator('#weeklyCollapse').click();await expect(page.locator('.weekly-report[open]')).toHaveCount(0);expect(f.reads()).toBe(reads);await expect(page.locator('#weeklySearch')).toBeFocused();
});
test('report actions use a keyboard-accessible disclosure and draft/public versions remain separate',async({page})=>{
 await reports(page,{draft:true});await page.locator('[data-ux-view=weekly]').click();await expect(page.locator('[data-report-key=weekly-meta]')).toHaveCount(2);
 const draft=page.locator('[data-weekly-draft][data-report-key=weekly-meta]');await draft.locator('summary').click();await expect(draft.locator('[data-delete-weekly]')).toBeHidden();
 await draft.locator('[data-report-menu]').click();await expect(draft.locator('[data-delete-weekly]')).toBeVisible();await draft.locator('[data-report-menu]').press('Escape');await expect(draft.locator('[data-delete-weekly]')).toBeHidden();await expect(draft.locator('[data-report-menu]')).toBeFocused();
 await expect(page.locator('[data-weekly-published][data-report-key=weekly-meta] .report-summary-text')).toContainText('122 обращения');
});
test('mobile reports preserve full text and hide editor actions for clients',async({page})=>{
 await page.setViewportSize({width:390,height:844});await reports(page,{viewer:true});await selectNovaSection(page,'weekly');
 const report=page.locator('[data-report-key=weekly-meta]');await report.locator('summary').click();await expect(report.locator('.report-field')).toHaveCount(4);await expect(page.locator('[data-edit-weekly],[data-report-menu]')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'dist/weekly-ux-mobile.png',fullPage:true});
});
