import {test,expect} from '@playwright/test';

const values=page=>page.locator('#novaMetricGroups .nova-metric').evaluateAll(nodes=>nodes.map(n=>[n.querySelector('.nova-metric-label').textContent.trim(),n.querySelector('.nova-metric-value').textContent.trim()]).sort());
const native=page=>page.locator('#clientMetricGroups .card[data-metric-group]').evaluateAll(nodes=>nodes.filter(n=>!n.hidden&&!n.classList.contains('hidden')).map(n=>{const value=n.querySelector('.value').cloneNode(true);value.querySelectorAll('.delta').forEach(e=>e.remove());return[n.querySelector('.label').textContent.trim(),value.textContent.trim()];}).sort());

test('NOVA dark and light layouts keep existing metrics readable and CRM reachable',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/nova-sales-demo/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);
 await expect.poll(async()=>JSON.stringify(await values(page))===JSON.stringify(await native(page))).toBe(true);
 await expect(page.locator('.nova-support-group')).toHaveCount(2);
 await expect(page.locator('.nova-support-group .nova-metric')).toHaveCount(8);
 for(const theme of ['dark','light']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#toysThemeToggle').click();
  for(const width of[1520,1440,1280,1240,1100,1024,960,768,761,760,430,390,360]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>new Promise(requestAnimationFrame));
   const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,clipped:[...document.querySelectorAll('.nova-metric')].filter(n=>{const box=n.getBoundingClientRect();return [...n.children].some(c=>{const r=c.getBoundingClientRect();return r.right>box.right+1||r.bottom>box.bottom+1||c.scrollWidth>c.clientWidth+1;});}).map(n=>n.textContent),black:getComputedStyle(document.querySelector('.nova-primary-metric strong')).color}));
   expect(result,theme+' at '+width).toEqual({overflow:false,clipped:[],black:'rgb(0, 0, 0)'});
   const crm=page.locator(width>760?'#platformCRMLink':'#platformCRMNav');await expect(crm).toBeInViewport({ratio:1});
   if(width<=760){const primary=await page.locator('.nova-primary-metric').boundingBox();expect(primary.y).toBeLessThan(520);}
  }
  for(const [width,height]of[[1520,1000],[390,844]]){
   await page.setViewportSize({width,height});await page.screenshot({path:`dist/nova-${theme}-${width}.png`,animations:'disabled'});
   if(width===390)await page.screenshot({path:`dist/nova-${theme}-mobile-full.png`,fullPage:true,animations:'disabled'});
  }
 }
 expect(errors).toEqual([]);
});

test('NOVA filters, calendar, glass navigation and CRM use the native workflows',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/nova-sales-demo/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);
 await page.locator('#novaChannelSelect').selectOption('Google Ads');await expect(page.locator('#platformSeg [data-platform="Google Ads"]')).toHaveClass(/active/);
 await expect(page.locator('.nova-support-group').filter({hasText:'Продажи CRM'}).locator('.nova-metric').first().locator('strong')).toHaveText('23');
 await expect.poll(async()=>JSON.stringify(await values(page))===JSON.stringify(await native(page))).toBe(true);
 await page.locator('#novaPeriodSelect').selectOption('7');await expect(page.locator('#periodSeg [data-days="7"]')).toHaveClass(/active/);
 await page.locator('#novaPeriodSelect').selectOption('max');await page.locator('#novaChannelSelect').selectOption('__all');
 await expect(page.locator('.nova-primary-metric strong')).toHaveText('1 416',{useInnerText:true});
 await expect.poll(async()=>JSON.stringify(await values(page))===JSON.stringify(await native(page))).toBe(true);
 await page.locator('#platformCalendar').click();await expect(page.locator('.platform-calendar')).toBeVisible();await page.keyboard.press('Escape');
 for(const view of ['campaigns','funnel','weekly','project','overview']){
  await page.locator(`#uxNav [data-ux-view=${view}]`).click();await expect(page.locator(`#uxNav [data-ux-view=${view}]`)).toHaveAttribute('aria-current','page');
  await page.waitForTimeout(480);
  const aligned=await page.evaluate(()=>{const active=document.querySelector('#uxNav a.active').getBoundingClientRect(),glass=document.querySelector('.nova-nav-glass').getBoundingClientRect();return Math.abs(active.left-glass.left)<1&&Math.abs(active.width-glass.width)<1;});expect(aligned).toBe(true);
 }
 await page.locator('#uxNav [data-ux-view=campaigns]').click();expect(await page.locator('.nova-nav-glass').evaluate(e=>e.getAnimations().length)).toBeGreaterThan(0);
 await page.waitForTimeout(480);await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#uxNav [data-ux-view=funnel]').click();expect(await page.locator('.nova-nav-glass').evaluate(e=>e.getAnimations().length)).toBe(0);
 await page.locator('#toysThemeToggle').click();await expect(page.locator('#uxNav [data-ux-view=funnel]')).toHaveAttribute('aria-current','page');
 await page.locator('#platformCRMLink').click();await expect(page.locator('#platformClientCRM .kanban-column').first()).toBeVisible();await expect(page.locator('#platformHomeNav')).toBeVisible();
 await page.locator('#platformHomeNav').click();await expect(page.locator('#uxNav')).toBeVisible();await expect(page.locator('#uxNav [data-ux-view=funnel]')).toHaveAttribute('aria-current','page');
 await page.setViewportSize({width:390,height:844});await page.locator('#clientSectionSelect').selectOption('overview');await expect(page.locator('#novaMetricGroups')).toBeVisible();
 await page.locator('#platformCRMNav').click();await expect(page.locator('#platformClientCRM .kanban-column').first()).toBeVisible();await page.locator('#platformHomeNav').click();await expect(page.locator('#novaMetricGroups')).toBeVisible();
});

test('NOVA section links keep native browser navigation',async({page,context})=>{
 await page.goto('/nova-sales-demo/');await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);
 const tab=page.locator('#uxNav [data-ux-view=campaigns]');await expect(tab).toHaveAttribute('href','#campaigns');
 const popupPromise=context.waitForEvent('page');await tab.click({button:'middle'});const popup=await popupPromise;
 await popup.waitForLoadState();await expect(popup.locator('#uxCampaigns')).toBeVisible();await expect(page.locator('#uxOverview')).toBeVisible();await popup.close();
});
