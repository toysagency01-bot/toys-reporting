import {test,expect} from '@playwright/test';

async function section(page,view){
 await page.locator('#novaSectionToggle').tap();await expect(page.locator('#novaSectionMenu')).toBeVisible();
 await page.locator(`#novaSectionMenu [data-nova-view=${view}]`).tap();await expect(page.locator('#novaSectionMenu')).toBeHidden();
}
async function settledProject(page){await expect(page.locator('#projectView #gLoading:visible,#projectView #pLoading:visible')).toHaveCount(0);}

for(const theme of ['dark','light'])test(`NOVA touch audit covers every section and project subtab in ${theme}`,async({browser,baseURL})=>{
 test.setTimeout(90000);
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,locale:'ru-RU'});
 await context.addInitScript(value=>localStorage.setItem('toys-dashboard-theme',value),theme);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-10-19T08:00:00Z'));
 await page.goto('/nova-sales-demo/');await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);await page.evaluate(()=>document.fonts.ready);
 for(const width of [320,360,390,430]){
  await page.setViewportSize({width,height:844});
  for(const view of ['overview','campaigns','funnel','weekly','project']){
   await section(page,view);await expect(page.locator('.ux-section:visible')).toHaveCount(view==='project'?0:1);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' / '+view).toBe(true);
   const fonts=await page.locator('button:visible,select:visible,input:visible,textarea:visible').evaluateAll(nodes=>nodes.filter(n=>!getComputedStyle(n).fontFamily.includes('Golos Text')).map(n=>n.outerHTML.slice(0,160)));expect(fonts).toEqual([]);
   if(view==='weekly'){
    const report=page.locator('.weekly-report').first();if(await report.getAttribute('open')===null)await report.locator('summary').tap();await expect(report).toHaveAttribute('open','');
    expect(await report.locator('.report-summary-text').evaluate(e=>e.scrollHeight<=e.clientHeight+1)).toBe(true);
   }
   if(view==='project'){
    for(const channel of await page.locator('#uxProjectChannels button').all()){
     await channel.tap();await settledProject(page);
     const count=await page.locator('#projectSubNav button').count();
     for(let i=0;i<count;i++){
      const button=page.locator('#projectSubNav button').nth(i);await button.tap();await settledProject(page);
      const strip=await page.locator('#projectSubNav button').evaluateAll(nodes=>nodes.every((n,i)=>n.scrollWidth<=n.clientWidth+1&&(!i||nodes[i-1].getBoundingClientRect().right<=n.getBoundingClientRect().left+1)));expect(strip).toBe(true);
      const cells=await page.locator('#gWrap .table-wrap td').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().width>=n.closest('tr').getBoundingClientRect().width-1));expect(cells).toBe(true);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
     }
    }
    if(width===390)await page.screenshot({path:`dist/nova-mobile-project-${theme}.png`,animations:'disabled'});
   }
  }
 }
 await section(page,'weekly');await page.locator('#uxWeeklyAdd').tap();await expect(page.locator('#weeklyForm')).toBeVisible();
 const field=page.locator('#weeklyForm textarea').first();await field.focus();
 const input=await field.evaluate(e=>{const s=getComputedStyle(e);return{font:s.fontFamily,size:parseFloat(s.fontSize),outline:s.outlineStyle};});expect(input.font).toContain('Golos Text');expect(input.size).toBeGreaterThanOrEqual(16);expect(input.outline).toBe('none');
 await page.locator('#closeWeeklyEditor').tap();
 await page.locator('#platformCRMNav').tap();const crm=page.locator('#platformClientCRM');await expect(crm.locator('.kanban-column').first()).toBeVisible();
 await crm.locator('#search').fill('Демо-клиент 0001');await crm.locator('.lead-card').first().tap();await expect(crm.locator('#editor')).toBeVisible();
 await page.keyboard.press('Escape');await page.locator('#platformHomeNav').tap();
 await page.locator('#novaSectionToggle').tap();await expect(page.locator('#novaSectionMenu')).toBeVisible();
 const face=await page.locator('#novaSectionMenu a').first().evaluate(e=>getComputedStyle(e).fontFamily);expect(face).toContain('Golos Text');
 await page.keyboard.press('Escape');
 await page.locator('#novaSectionToggle').focus();
 const ring=await page.locator('#novaSectionToggle').evaluate(e=>({inner:getComputedStyle(e).outlineStyle,outer:getComputedStyle(e.parentElement).outlineStyle,shadow:getComputedStyle(e).boxShadow}));expect(ring).toEqual({inner:'none',outer:'none',shadow:'none'});
 expect(errors).toEqual([]);await context.close();
});

test('NOVA touch control indicators travel across real animation frames without disappearing',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'no-preference'});
 const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-10-19T08:00:00Z'));await page.goto('/nova-sales-demo/');await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);
 for(const theme of ['dark','light']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#toysThemeToggle').tap();
  await page.locator('#platformSeg [data-platform="__all"]').tap();await page.waitForTimeout(520);
  await page.locator('#periodSeg [data-days="7"]').tap();await page.waitForTimeout(520);
  for(const [root,target]of [['#platformSeg','[data-platform="Google Ads"]'],['#periodSeg','[data-days="30"]']]){
   await page.evaluate(selector=>{window.novaFrames=[];const start=performance.now();function frame(){const e=document.querySelector(selector+' .nova-control-slider'),r=e.getBoundingClientRect();window.novaFrames.push({time:performance.now()-start,x:r.left,visible:!e.hidden&&getComputedStyle(e).visibility==='visible'&&r.height>0});if(performance.now()-start<750)requestAnimationFrame(frame);}requestAnimationFrame(frame);},root);
   await page.locator(root+' '+target).tap();await page.waitForFunction(()=>window.novaFrames.at(-1)?.time>=750);
   const frames=await page.evaluate(()=>novaFrames);expect(frames.every(f=>f.visible)).toBe(true);expect(new Set(frames.map(f=>Math.round(f.x*10))).size).toBeGreaterThan(4);
   await expect(page.locator(root+' .nova-control-slider')).toHaveCount(1);
   expect(await page.locator(root+' .nova-control-slider').evaluate(e=>e.getAnimations().every(a=>a.effect.getKeyframes().every(k=>!('width'in k))))).toBe(true);
  }
 }
 await context.close();
});

test('NOVA calendar is opaque on phone and desktop and supports touch date selection',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await context.addInitScript(()=>localStorage.setItem('toys-dashboard-theme','light'));const page=await context.newPage();await page.goto('/nova-sales-demo/');await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:844});await page.locator('#platformCalendar').tap();
  const dialog=page.locator('.platform-calendar');await expect(dialog).toBeVisible();expect(await dialog.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(255, 255, 255)');
  expect(await dialog.evaluate(e=>getComputedStyle(e).webkitTapHighlightColor)).toBe('rgba(0, 0, 0, 0)');
  expect(await dialog.evaluate(e=>e.getBoundingClientRect().height<=innerHeight-20)).toBe(true);
  await page.screenshot({path:`dist/nova-calendar-opaque-${width}.png`,animations:'disabled'});
  await dialog.locator('[aria-label="Закрыть календарь"]').tap();
 }
 await page.setViewportSize({width:390,height:844});await page.locator('#platformCalendar').tap();
 const dialog=page.locator('.platform-calendar');await dialog.locator('[data-next]').tap();await dialog.locator('[data-next]').tap();
 await dialog.locator('[data-date="2026-10-13"]').tap();await dialog.locator('[data-date="2026-10-19"]').tap();await dialog.locator('[data-apply]').tap();
 await expect(page.locator('#dateFrom')).toHaveValue('2026-10-13');await expect(page.locator('#dateTo')).toHaveValue('2026-10-19');
 // Point 2 was explicitly deferred: keep the existing comparison badge treatment.
 await expect(page.locator('.nova-lead-feature .nova-delta').first()).toBeVisible();
 expect(await page.locator('.nova-lead-feature .nova-delta').first().evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(13, 37, 33)');
 await context.close();
});

test('NOVA phone menu and calendar stay inside short screens after rotation',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:320,height:568},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await context.addInitScript(()=>localStorage.setItem('toys-dashboard-theme','light'));const page=await context.newPage();await page.goto('/nova-sales-demo/');await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);
 await page.locator('#novaSectionToggle').tap();
 const bounds=await page.locator('#novaSectionMenu').boundingBox();expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(568);
 await page.locator('#novaSectionMenu [data-nova-view=overview]').tap();
 for(const [width,height]of [[320,568],[844,390],[390,700]]){
  await page.setViewportSize({width,height});await page.locator('#platformCalendar').tap();
  const calendar=page.locator('.platform-calendar'),r=await calendar.boundingBox();expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThanOrEqual(height);
  expect(await calendar.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(255, 255, 255)');await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 await context.close();
});
