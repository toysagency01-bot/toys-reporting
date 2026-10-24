import {test,expect} from '@playwright/test';
import {selectNovaSection} from './nova-browser-helpers.mjs';
import {projectFixture,sourceMetrics,displayMetrics} from './project-design-fixture.mjs';

for(const slug of ['housevip-cxp7','bs-clinic-a5b4','profkit-instashop-r4vk','karlovarska-sul-k4rm'])test(slug+' uses the approved design while preserving its own metric groups, values and workflows',async({page,request})=>{
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fixture=await projectFixture({page,request,slug});
 await page.setViewportSize({width:1440,height:1000});await page.goto('/'+slug+'/');
 await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await page.getByRole('button',{name:'Максимум',exact:true}).click();
 await expect(page.locator('#novaMetricGroups')).toBeVisible();
 await expect(page.locator('#platformCRMStats')).toBeAttached();
 await expect.poll(async()=>JSON.stringify(await sourceMetrics(page))===JSON.stringify(await displayMetrics(page))).toBe(true);
 const groups=await page.locator('#clientMetricGroups>.client-metric-group').evaluateAll(nodes=>nodes.map(n=>({key:n.dataset.metricGroup,title:n.querySelector('h2').textContent,count:n.getAttribute('aria-owns').split(' ').filter(Boolean).length})));
 expect(groups.every(g=>g.count>0&&g.count<=4)).toBe(true);
 if(slug.includes('instashop')){expect(groups.some(g=>g.key.startsWith('inquiries-'))).toBe(true);await expect(page.locator('.nova-primary-metric .nova-metric-label')).toHaveText('Direct-обращения');}
 else if(slug.startsWith('karl')){expect(groups.some(g=>g.key.startsWith('commerce-sales-'))).toBe(true);await expect(page.locator('#novaMetricGroups')).toHaveClass(/nova-without-feature/);}
 else await expect(page.locator('.nova-primary-metric .nova-metric-label')).toHaveText('Лиды');
 for(const theme of ['dark','light']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#toysThemeToggle').click();
  for(const width of [1440,1280,1024,768,390,360,320]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>new Promise(requestAnimationFrame));
   await expect.poll(()=>page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,clipped:[...document.querySelectorAll('.nova-metric')].filter(e=>{const r=e.getBoundingClientRect();return [...e.children].some(n=>{const b=n.getBoundingClientRect();return b.right>r.right+1||n.scrollWidth>n.clientWidth+1;});}).map(e=>e.textContent)})),{message:slug+' '+theme+' '+width}).toEqual({overflow:false,clipped:[]});
   await expect.poll(async()=>JSON.stringify(await sourceMetrics(page))===JSON.stringify(await displayMetrics(page))).toBe(true);
   await expect(page.locator(width>760?'#platformCRMLink':'#platformCRMNav')).toBeInViewport({ratio:1});
   const shown=await page.locator('#novaMetricGroups').innerText();expect(shown).not.toMatch(/\b(?:EUR|USD|CZK|UAH|IDR)\b/);
   if([1440,390].includes(width))await page.screenshot({path:`dist/project-${slug}-${theme}-${width}.png`});
  }
 }
 await selectNovaSection(page,'weekly');await expect(page.locator('#uxWeekly')).toBeVisible();await expect(page.locator('#controls,.controls').first()).toBeHidden();
 await selectNovaSection(page,'campaigns');await expect(page.locator('.campaign-entity')).toHaveCount(1);const reads=fixture.campaignReads();
 await expect(page.locator('.campaign-list')).toContainText('€');expect(await page.locator('.campaign-list').innerText()).not.toMatch(/[·•∙]/);
 await expect(page.locator('.campaign-row .campaign-cell')).toHaveCount(slug.startsWith('karl')?8:6);expect(fixture.campaignReads()).toBe(reads);
 await selectNovaSection(page,'funnel');await page.setViewportSize({width:390,height:900});
 const stages=page.locator('#funnel .funnel-step');expect(await stages.count()).toBeGreaterThanOrEqual(3);
 const accents=await stages.evaluateAll(nodes=>nodes.map(e=>getComputedStyle(e).borderLeftColor));expect(new Set(accents).size).toBeGreaterThan(1);
 await page.screenshot({path:`dist/project-${slug}-funnel-mobile.png`});
 if(slug.startsWith('karl')){
  fixture.data.dashboard.ecommerce.account.rows[0].date='2025-01-01';await page.evaluate(async()=>{sessionStorage.clear();for(const key of await caches.keys())await caches.delete(key);});
  await page.reload();await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await selectNovaSection(page,'overview');
  await expect.poll(async()=>JSON.stringify(await sourceMetrics(page))===JSON.stringify(await displayMetrics(page))).toBe(true);
 }
 expect(errors).toEqual([]);
});
