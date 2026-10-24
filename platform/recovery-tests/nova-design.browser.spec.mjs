import {test,expect} from '@playwright/test';

const values=page=>page.locator('#novaMetricGroups .nova-metric').evaluateAll(nodes=>nodes.map(n=>[n.querySelector('.nova-metric-label').textContent.trim(),n.querySelector('.nova-metric-value').dataset.fullValue||n.querySelector('.nova-metric-value').textContent.trim()]).sort());
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
 await page.locator('#platformSeg [data-platform="Google Ads"]').click();await expect(page.locator('#platformSeg [data-platform="Google Ads"]')).toHaveClass(/active/);
 await expect(page.locator('.nova-support-group').filter({hasText:'Продажи CRM'}).locator('.nova-metric').first().locator('strong')).toHaveText('23');
 await expect.poll(async()=>JSON.stringify(await values(page))===JSON.stringify(await native(page))).toBe(true);
 await page.locator('#periodSeg [data-days="7"]').click();await expect(page.locator('#periodSeg [data-days="7"]')).toHaveClass(/active/);
 await page.locator('#periodSeg [data-days="max"]').click();await page.locator('#platformSeg [data-platform="__all"]').click();
 await expect(page.locator('.nova-primary-metric strong')).toHaveText('1 416',{useInnerText:true});
 await expect.poll(async()=>JSON.stringify(await values(page))===JSON.stringify(await native(page))).toBe(true);
 await page.locator('#platformCalendar').click();await expect(page.locator('.platform-calendar')).toBeVisible();await page.keyboard.press('Escape');
 for(const view of ['campaigns','funnel','weekly','project','overview']){
  await page.locator(`#uxNav [data-ux-view=${view}]`).click();await expect(page.locator(`#uxNav [data-ux-view=${view}]`)).toHaveAttribute('aria-current','page');
  await expect.poll(()=>page.evaluate(()=>{const active=document.querySelector('#uxNav a.active').getBoundingClientRect(),glass=document.querySelector('.nova-nav-glass').getBoundingClientRect();return Math.abs(active.left-glass.left)<1&&Math.abs(active.width-glass.width)<1;})).toBe(true);
 }
 await page.locator('#uxNav [data-ux-view=campaigns]').click();expect(await page.locator('.nova-nav-glass').evaluate(e=>e.getAnimations().length)).toBeGreaterThan(0);
 await page.waitForTimeout(780);await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#uxNav [data-ux-view=funnel]').click();expect(await page.locator('.nova-nav-glass').evaluate(e=>e.getAnimations().length)).toBe(0);
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

test('NOVA glass stays neutral and continues smoothly when tabs change mid-slide',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/nova-sales-demo/');await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);
 for(const theme of ['dark','light']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#toysThemeToggle').click();
  const palette=await page.evaluate(()=>({bg:getComputedStyle(document.body).backgroundColor,glass:getComputedStyle(document.querySelector('.nova-nav-glass')).backgroundImage}));
  const rgb=palette.bg.match(/[\d.]+/g).slice(0,3).map(Number);expect(rgb[0]).toBe(rgb[1]);expect(rgb[1]).toBe(rgb[2]);
  expect(palette.glass).toContain('gradient');
  if(theme==='light')expect(palette.glass.match(/rgba?\([^)]+\)/g).every(c=>{const numbers=c.match(/[\d.]+/g).slice(0,3).map(Number);return numbers[0]===numbers[1]&&numbers[1]===numbers[2];})).toBe(true);
  await expect(page.locator('#platformSeg [data-platform="Google Ads"] svg')).toBeVisible();await expect(page.locator('#platformSeg [data-platform="Meta Ads"] svg')).toBeVisible();
  await page.locator('#uxNav [data-ux-view=overview]').click();await page.waitForTimeout(780);
  const from=(await page.locator('.nova-nav-glass').boundingBox()).x;
  await page.locator('#uxNav [data-ux-view=project]').click();await expect.poll(()=>page.locator('.nova-nav-glass').evaluate(e=>e.getAnimations().length)).toBeGreaterThan(0);
  const middle=await page.locator('.nova-nav-glass').evaluate(e=>{const a=e.getAnimations()[0];a.pause();a.currentTime=180;return e.getBoundingClientRect().left;});
  const to=(await page.locator('#uxNav [data-ux-view=project]').boundingBox()).x;expect(middle).toBeGreaterThan(from+2);expect(middle).toBeLessThan(to-2);
  await page.locator('#uxNav [data-ux-view=campaigns]').click();
  const resumed=await page.locator('.nova-nav-glass').evaluate(e=>{const a=e.getAnimations()[0];a.pause();a.currentTime=0;return e.getBoundingClientRect().left;});expect(Math.abs(resumed-middle)).toBeLessThan(2);
  await page.locator('.nova-nav-glass').evaluate(e=>e.getAnimations()[0].finish());
 }
});

test('NOVA secondary blocks fit both themes and preserve campaign, funnel and report content',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/nova-sales-demo/');await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);
 for(const theme of ['dark','light']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#toysThemeToggle').click();
  for(const width of [1440,768,390,360]){
   await page.setViewportSize({width,height:900});
   for(const view of ['overview','campaigns','funnel','weekly','project']){
    if(width<=760)await page.locator('#clientSectionSelect').selectOption(view);else await page.locator(`#uxNav [data-ux-view=${view}]`).click();
    await expect(page.locator('.ux-section:visible')).toHaveCount(view==='project'?0:1);
    const section=view==='project'?'#projectView':'#ux'+view[0].toUpperCase()+view.slice(1);
    await expect(page.locator(section+' .ux-page-heading h1').first()).toBeInViewport({ratio:1});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),theme+' / '+width+' / '+view).toBe(true);
    if(view==='campaigns'){
     await expect(page.locator('.campaign-entity')).toHaveCount(5);
     await expect(page.locator('#platformCampaignBrowser')).not.toContainText(/[·•∙]/);
     const clipped=await page.locator('.campaign-cell').evaluateAll(nodes=>nodes.filter(n=>[...n.children].some(c=>c.scrollWidth>c.clientWidth+1)).map(n=>n.textContent));expect(clipped).toEqual([]);
    }
    if(view==='funnel')await expect(page.locator('#demoSalesFunnel [data-stage=sales]')).toContainText('203');
    if(view==='weekly'){await expect(page.locator('#weeklyContent')).toContainText('ДЕМО');await expect(page.locator('#controls')).toBeHidden();}
    if(view==='project'){await expect(page.locator('#projectView')).toContainText('О проекте');await expect(page.locator('#controls')).toBeHidden();}
    if([1440,390].includes(width)&&view!=='overview')await page.screenshot({path:`dist/nova-block-${view}-${theme}-${width}.png`,animations:'disabled'});
   }
  }
 }
 expect(errors).toEqual([]);
});

test('NOVA revenue compacts only when it overflows and restores full amounts when space returns',async({page})=>{
 await page.route('**/projects/nova-sales-demo/sales-analytics?*',async route=>{const response=await route.fetch(),data=await response.json();data.totals.revenue=146148.75;await route.fulfill({json:data});});
 await page.goto('/nova-sales-demo/');await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);
 const revenue=page.locator('.nova-metric').filter({has:page.getByText('Выручка CRM',{exact:true})}).locator('.nova-metric-value');
 const full=await revenue.getAttribute('data-full-value');
 for(const theme of ['dark','light']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#toysThemeToggle').click();
  await page.setViewportSize({width:360,height:844});
  await expect(revenue).toHaveText('146,1k €');await expect(revenue).toHaveAttribute('title',full);await expect(revenue).toHaveAttribute('aria-label',full);
  expect(await revenue.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  await page.setViewportSize({width:1180,height:1000});await expect(revenue).toHaveText('146 148,75 €');
  await expect(revenue).not.toHaveAttribute('title');
 }
});

test('NOVA flat control sliders share faster header motion and respect reduced motion',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/nova-sales-demo/');await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);
 await page.locator('#uxNav [data-ux-view=funnel]').click();await expect.poll(()=>page.locator('.nova-nav-glass').evaluate(e=>e.getAnimations()[0]?.effect.getTiming().duration||0)).toBe(480);
 await page.locator('#platformSeg [data-platform="Google Ads"]').click();
 const channel=page.locator('#platformSeg .nova-control-slider');await expect.poll(()=>channel.evaluate(e=>e.getAnimations()[0]?.effect.getTiming().duration||0)).toBe(480);
 const material=await channel.evaluate(e=>({blur:getComputedStyle(e).backdropFilter,fill:getComputedStyle(e).backgroundImage}));expect(material).toEqual({blur:'none',fill:'none'});
 await page.locator('#periodSeg [data-days="7"]').click();await page.locator('#periodSeg [data-days="30"]').click();
 await expect.poll(()=>page.locator('#periodSeg .nova-control-slider').evaluate(e=>e.getAnimations()[0]?.effect.getTiming().duration||0)).toBe(480);
 await page.locator('#uxNav [data-ux-view=overview]').click();
 expect(await page.locator('.ux-insight button').evaluate(e=>getComputedStyle(e).backgroundImage)).toBe('none');
 expect(await page.locator('#platformCalendar').evaluate(e=>getComputedStyle(e).backdropFilter)).toBe('none');
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#platformSeg [data-platform="__all"]').click();expect(await channel.evaluate(e=>e.getAnimations().length)).toBe(0);
});

test('NOVA restores the native comparison percentages and cost-direction colors',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-19T08:00:00Z'));
 await page.goto('/nova-sales-demo/');await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);await page.locator('#periodSeg [data-days="7"]').click();
 await expect.poll(()=>page.locator('#novaMetricGroups .nova-delta').count()).toBeGreaterThan(0);
 const source=()=>page.locator('#clientMetricGroups .card .delta').evaluateAll(nodes=>nodes.map(n=>({label:n.closest('.card').querySelector('.label').textContent.trim(),text:n.textContent.trim(),kind:[...n.classList].find(c=>c.startsWith('delta-'))})).sort((a,b)=>a.label.localeCompare(b.label)));
 const shown=()=>page.locator('#novaMetricGroups .nova-delta').evaluateAll(nodes=>nodes.map(n=>({label:n.closest('.nova-metric').querySelector('.nova-metric-label').textContent.trim(),text:n.textContent.trim(),kind:[...n.classList].find(c=>c.startsWith('delta-'))})).sort((a,b)=>a.label.localeCompare(b.label)));
 await expect.poll(async()=>JSON.stringify(await source())===JSON.stringify(await shown())).toBe(true);
 for(const theme of ['dark','light']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#toysThemeToggle').click();
  const colors=await page.locator('.nova-delta').evaluateAll(nodes=>nodes.map(e=>({kind:[...e.classList].find(c=>c.startsWith('delta-')),color:getComputedStyle(e).color})));for(const c of colors){const [r,g,b]=c.color.match(/[\d.]+/g).map(Number);if(c.kind==='delta-good')expect(g).toBeGreaterThan(r);if(c.kind==='delta-bad')expect(r).toBeGreaterThan(g);}
  await page.screenshot({path:`dist/nova-trends-${theme}.png`,animations:'disabled'});
 }
 await page.locator('#periodSeg [data-days=max]').click();await expect(page.locator('#novaMetricGroups .nova-delta')).toHaveCount(0);
});
