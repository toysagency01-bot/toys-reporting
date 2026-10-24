import {test,expect} from '@playwright/test';

const watchFrames=()=>{
 window.novaBootFrames=[];let readyFrames=0;
 const visible=e=>!!e&&getComputedStyle(e).visibility==='visible'&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;
 function frame(){
  const ready=document.body?.dataset.platformReady==='true',header=document.querySelector('body>header');
  window.novaBootFrames.push({ready,loading:visible(document.getElementById('novaBootScreen')),legacy:visible(header)&&!document.body.classList.contains('nova-demo-design')||visible(document.getElementById('clientMetricGroups'))});
  if(ready)readyFrames++;
  if(readyFrames<6&&window.novaBootFrames.length<900)requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
};

for(const theme of ['dark','light'])for(const width of [1440,390])test(`NOVA ${theme} ${width}px never paints the old design on delayed cold load or reload`,async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});
 await context.addInitScript(value=>localStorage.setItem('toys-dashboard-theme',value),theme);await context.addInitScript(watchFrames);
 const page=await context.newPage();let release;
 const held=new Promise(resolve=>release=resolve);
 await page.route('**/api/v2/projects/nova-sales-demo/dashboard*',async route=>{await held;await route.continue();});
 await page.goto('/nova-sales-demo/',{waitUntil:'domcontentloaded'});
 const screen=page.locator('#novaBootScreen');await expect(screen).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
 await expect(page.locator('body')).toHaveAttribute('aria-busy','true');
 // The actual legacy markup has arrived while data remains blocked. It must
 // stay absent from every painted frame, rather than being hidden after paint.
 await page.locator('body>header').waitFor({state:'attached'});await expect(page.locator('body>header')).toBeHidden();
 await page.waitForFunction(()=>novaBootFrames.filter(f=>f.loading).length>=8);
 expect(await screen.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(theme==='light'?'rgb(245, 245, 245)':'rgb(9, 9, 9)');
 await page.screenshot({path:`dist/nova-loading-${theme}-${width}.png`});
 release();await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);await expect(screen).toHaveCount(0);
 await expect(page.locator('html')).not.toHaveAttribute('data-nova-boot');await expect(page.locator('body')).toHaveAttribute('aria-busy','false');
 await page.waitForFunction(()=>novaBootFrames.filter(f=>f.ready).length>=6);
 expect(await page.evaluate(()=>novaBootFrames.some(f=>f.legacy))).toBe(false);
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);await page.waitForFunction(()=>novaBootFrames.filter(f=>f.ready).length>=6);
 expect(await page.evaluate(()=>novaBootFrames.some(f=>f.legacy))).toBe(false);await expect(screen).toHaveCount(0);
 await context.close();
});

test('NOVA initial data failure shows a usable error state without revealing the old shell and recovers on reload',async({page})=>{
 await page.route('**/api/v2/projects/nova-sales-demo/dashboard*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'service_unavailable'})}));
 await page.goto('/nova-sales-demo/');await expect(page.locator('#novaBootScreen [role=alert]')).toContainText('Не удалось загрузить борд');
 await expect(page.locator('html')).toHaveAttribute('data-nova-boot','error');await expect(page.locator('body')).toHaveAttribute('aria-busy','false');
 await expect(page.locator('.nova-boot-grid')).toBeHidden();await expect(page.locator('body>header')).toBeHidden();
 await page.unroute('**/api/v2/projects/nova-sales-demo/dashboard*');await page.reload();
 await expect(page.locator('#novaMetricGroups .nova-metric')).toHaveCount(12);await expect(page.locator('#novaBootScreen')).toHaveCount(0);
});
