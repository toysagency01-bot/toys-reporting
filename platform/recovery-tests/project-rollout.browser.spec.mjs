import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {projectFixture,sourceMetrics,displayMetrics} from './project-design-fixture.mjs';
import {selectNovaSection} from './nova-browser-helpers.mjs';
const registry=JSON.parse(readFileSync(new URL('../projects.json',import.meta.url),'utf8'));
const covered=new Set(['nova-sales-demo','housevip-cxp7','bs-clinic-a5b4','profkit-instashop-r4vk','karlovarska-sul-k4rm']);

for(const[slug,project]of Object.entries(registry))if(!covered.has(slug))test('new project design is complete for '+slug,async({page,request})=>{
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));await projectFixture({page,request,slug});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/'+slug+'/');
 await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await page.getByRole('button',{name:'Максимум',exact:true}).click();
 await expect(page.locator('body>header .sub')).toHaveText(project.title);await expect(page.locator('#salesDemoNotice')).toHaveCount(0);
 for(const theme of ['dark','light']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#toysThemeToggle').click();
  for(const width of [1440,1024,390,320]){
   await page.setViewportSize({width,height:900});
   await expect.poll(async()=>JSON.stringify(await sourceMetrics(page))===JSON.stringify(await displayMetrics(page))).toBe(true);
   expect(await page.locator('#novaMetricGroups .nova-metric').count()).toBeGreaterThanOrEqual(6);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
 }
 for(const view of ['campaigns','funnel','weekly','project','overview']){
  await selectNovaSection(page,view);await expect(page.locator(view==='project'?'#projectView':'#ux'+view[0].toUpperCase()+view.slice(1))).toBeVisible();
 }
 await expect(page.locator('#novaBootScreen')).toHaveCount(0);expect(errors).toEqual([]);
});

test('project redesign preserves multi-currency revenue without merging amounts',async({page,request})=>{
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));await projectFixture({page,request,slug:'housevip-cxp7'});
 await page.route('**/projects/housevip-cxp7/crm/summary?*',r=>r.fulfill({json:{ok:true,available:true,qualified:3,sales:2,revenue:[{value:123456,currency:'EUR'},{value:7654321,currency:'CZK'}]}}));
 await page.goto('/housevip-cxp7/');await page.getByRole('button',{name:'Максимум',exact:true}).click();
 await expect.poll(async()=>JSON.stringify(await sourceMetrics(page))===JSON.stringify(await displayMetrics(page))).toBe(true);
 const revenue=page.locator('.nova-metric').filter({has:page.locator('.nova-metric-label',{hasText:'Выручка CRM'})}).locator('.nova-metric-value');
 await expect(revenue.locator('br')).toHaveCount(1);await expect(revenue).toContainText('€');await expect(revenue).toContainText('Kč');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});await expect.poll(()=>revenue.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);}
});

test('project redesign preserves assigned team/client access and private NOVA policy',async({browser,baseURL})=>{
 for(const role of ['team','client']){
  const context=await browser.newContext({baseURL,extraHTTPHeaders:{'x-test-role':role},viewport:{width:390,height:844}}),page=await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
  await projectFixture({page,request:context.request,slug:'housevip-cxp7'});await page.goto('/housevip-cxp7/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
  await page.getByRole('button',{name:'Максимум',exact:true}).click();
  await expect(page.locator('#novaMetricGroups')).toBeVisible();
  expect((await context.request.get('/api/v2/projects/amklinika-k8m2/dashboard')).status()).toBe(403);
  expect((await context.request.get('/api/v2/projects/nova-sales-demo/dashboard')).status()).toBe(403);
  if(role==='client')await expect(page.locator('#uxWeeklyAdd:visible')).toHaveCount(0);
  await context.close();
 }
});
