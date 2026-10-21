import {test,expect} from '@playwright/test';
const api='/api/v2/projects/housevip-cxp7/crm';
const column=(page,status)=>page.locator(`.kanban-column[data-stage="${status}"]`);
async function seed(request,prefix,count=1){
 const leads=[];for(let i=0;i<count;i++){
  const r=await request.post(api,{headers:{origin:'http://127.0.0.1:4173','x-idempotency-key':prefix+i},data:{name:prefix+i,email:prefix+i+'@example.test'}});
  expect(r.ok(),await r.text()).toBe(true);leads.push((await r.json()).lead);
 }return leads;
}
async function open(page,prefix,url='/master/#crm'){
 await page.goto(url);const loaded=page.waitForResponse(r=>r.url().includes('/crm?')&&new URL(r.url()).searchParams.get('q')===prefix);await page.locator('#search').fill(prefix);await loaded;await expect(page.locator('.lead-card').first()).toBeVisible();
}
async function startDrag(page,card){
 await card.scrollIntoViewIfNeeded();const b=await card.boundingBox();
 await page.mouse.move(b.x+40,b.y+35);await page.mouse.down();await page.mouse.move(b.x+55,b.y+48,{steps:6});
 await expect(page.locator('.lead-card.dragging')).toHaveCount(1);
}
test('bottom cards drop into full-height short stages and pinned headers in embedded and master CRM',async({page,request})=>{
 const prefix='bottom-'+Date.now()+'-';await seed(request,prefix,18);
 for(const url of ['/api/v2/projects/housevip-cxp7/content-crm','/master/#crm']){
  await open(page,prefix,url);const source=column(page,'Новый');
  const card=source.locator('.lead-card').last(),id=await card.getAttribute('data-card');await card.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(1500);
  const pinned=page.locator('[data-drop-stage="В работе"]');await expect(pinned).toBeInViewport();
  expect(await column(page,'В работе').evaluate(el=>{const r=el.getBoundingClientRect();return r.top<0&&r.bottom>innerHeight/2;})).toBe(true);
  await startDrag(page,card);
  if(url.includes('content-crm')){const b=await column(page,'В работе').boundingBox();await page.mouse.move(b.x+90,650,{steps:12});}
  else{const b=await pinned.boundingBox();await page.mouse.move(b.x+70,b.y+b.height/2,{steps:12});}
  await page.mouse.up();await expect(column(page,'В работе').locator(`[data-card="${id}"]`)).toBeVisible();
  await expect(page.locator(`[data-card="${id}"]`)).toHaveAttribute('aria-busy','false');
 }
 await page.screenshot({path:'/tmp/kanban-pinned-desktop.png'});
});
test('native dragging autoscrolls vertically and horizontally and accepts mouse-wheel scrolling',async({page,request})=>{
 const prefix='scroll-'+Date.now()+'-';await seed(request,prefix,20);await open(page,prefix);
 const card=column(page,'Новый').locator('.lead-card').nth(10);await startDrag(page,card);
 const b=await column(page,'Новый').boundingBox(),before=await page.evaluate(()=>scrollY);
 await page.mouse.move(b.x+140,15,{steps:12});await page.mouse.move(b.x+140,15);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThan(before-200);
 await page.mouse.move(b.x+140,945,{steps:12});await page.mouse.move(b.x+140,945);const top=await page.evaluate(()=>scrollY);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(top+160);
 await page.mouse.move(b.x+140,450,{steps:10});
 // Browsers may route the physical wheel to the native drag loop; exercise
 // the explicit wheel fallback separately while the native drag is active.
 const scrollBefore=await page.evaluate(()=>scrollY);
 await page.locator('#leadsBoard').dispatchEvent('wheel',{deltaY:-300,deltaMode:0,bubbles:true,cancelable:true});
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThan(scrollBefore-200);
 await page.mouse.move(1430,450,{steps:15});await page.mouse.move(1430,450);await expect.poll(()=>page.locator('#leadsBoard').evaluate(el=>el.scrollLeft)).toBeGreaterThan(150);
 await page.keyboard.press('Escape');await page.mouse.up();await expect(page.locator('.dragging')).toHaveCount(0);
 const stopped=await page.locator('#leadsBoard').evaluate(el=>el.scrollLeft);await page.waitForTimeout(200);expect(await page.locator('#leadsBoard').evaluate(el=>el.scrollLeft)).toBe(stopped);
});
test('optimistic move updates immediately, concurrent failure rolls back only its card and metrics',async({page,request})=>{
 const prefix='instant-'+Date.now()+'-';await seed(request,prefix,2);await open(page,prefix);
 const cards=column(page,'Новый').locator('.lead-card'),ids=await cards.evaluateAll(els=>els.map(e=>e.dataset.card));
 let releaseFirst,releaseSecond;const first=new Promise(r=>releaseFirst=r),second=new Promise(r=>releaseSecond=r);
 await page.route('**/crm/leads/*',async route=>{
  if(route.request().method()!=='PATCH')return route.continue();
  if(route.request().url().endsWith(ids[0])){await first;return route.continue();}
  await second;return route.fulfill({status:503,json:{ok:false,error:'test_save_failed'}});
 });
 await page.locator(`[data-card="${ids[0]}"]`).dragTo(column(page,'Квалифицирован').locator('.stage-heading'));
 await expect(column(page,'Квалифицирован').locator(`[data-card="${ids[0]}"]`)).toBeDisabled();
 const metric=page.locator('#crmSummary .card').filter({has:page.locator('.label',{hasText:'Квалы'})}).locator('.value');
 await expect(metric).toHaveText('1');
 // Do not trigger any additional board GET after a successful move.
 let boardReads=0;page.on('request',r=>{if(r.url().includes('/crm?')&&r.method()==='GET')boardReads++;});
 await page.locator(`[data-card="${ids[1]}"]`).dragTo(column(page,'В работе').locator('.stage-heading'));
 await expect(column(page,'В работе').locator(`[data-card="${ids[1]}"]`)).toBeDisabled();
 releaseFirst();await expect(page.locator(`[data-card="${ids[0]}"]`)).toBeEnabled();expect(boardReads).toBe(0);
 releaseSecond();await expect(column(page,'Новый').locator(`[data-card="${ids[1]}"]`)).toBeEnabled();
 await expect(column(page,'Квалифицирован').locator(`[data-card="${ids[0]}"]`)).toBeEnabled();await expect(metric).toHaveText('1');
 await expect(page.locator('.kanban-notice')).toContainText('Не удалось сохранить перенос');
 await page.reload();await page.locator('#search').fill(prefix);await expect(column(page,'Квалифицирован')).toContainText(prefix);await expect(column(page,'Новый')).toContainText(prefix);
});
test('mobile page scroll and horizontal navigation retain visible stage labels without inner scroll',async({page,request})=>{
 const prefix='mobile-drag-'+Date.now()+'-';await seed(request,prefix,12);await page.setViewportSize({width:390,height:844});await open(page,prefix,'/api/v2/projects/housevip-cxp7/content-crm');
 await column(page,'Новый').locator('.lead-card').last().scrollIntoViewIfNeeded();await expect(page.locator('[data-drop-stage="Новый"]')).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await column(page,'Новый').locator('.stage-cards').evaluate(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollTop===0)).toBe(true);
 const slider=page.getByRole('slider',{name:'Прокрутка этапов'});await slider.fill('1000');await expect(page.locator('[data-drop-stage="Потерян"]')).toBeInViewport();
 await page.screenshot({path:'/tmp/kanban-pinned-mobile.png'});
 const before=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,-400);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThan(before-150);
});
test('a late failed move cannot modify a different board; returning reads the actual state',async({page,request})=>{
 const prefix='scope-'+Date.now()+'-';await seed(request,prefix);
 const created=await request.post(api+'/boards',{headers:{origin:'http://127.0.0.1:4173','x-idempotency-key':prefix+'board'},data:{name:prefix,stages:[{label:'Другая входящая'},{label:'Сделка',kind:'sale'}]}});
 expect(created.ok(),await created.text()).toBe(true);const board=(await created.json()).board;
 await open(page,prefix);const id=await page.locator('.lead-card').getAttribute('data-card');
 let release;const held=new Promise(r=>release=r);
 await page.route('**/crm/leads/'+id,async route=>{if(route.request().method()!=='PATCH')return route.continue();await held;return route.fulfill({status:503,json:{ok:false,error:'late_failure'}});});
 await page.locator(`[data-card="${id}"]`).dragTo(column(page,'В работе').locator('.stage-heading'));
 await expect(column(page,'В работе').locator(`[data-card="${id}"]`)).toBeDisabled();
 await page.locator('#boardTrigger').click();await page.locator(`[data-board="${board.id}"][role=menuitemradio]`).click();await expect(page.locator('#funnelName')).toHaveText(prefix);
 release();await expect(page.locator('#leadCount')).toHaveText('0');await expect(page.locator('.lead-card')).toHaveCount(0);await expect(page.locator('.kanban-notice')).toBeHidden();
 await page.locator('#boardTrigger').click();await page.locator('[data-board="default"][role=menuitemradio]').click();await expect(column(page,'Новый').locator(`[data-card="${id}"]`)).toBeEnabled();
});
test('a conflict refreshes the real CRM state and the next move uses its latest version',async({page,request})=>{
 const prefix='conflict-'+Date.now()+'-';await seed(request,prefix);await open(page,prefix);const id=await page.locator('.lead-card').getAttribute('data-card');
 await page.route('**/crm/leads/'+id,async route=>{
  const body=route.request().postDataJSON();const changed=await request.patch(api+'/leads/'+id,{headers:{origin:'http://127.0.0.1:4173','x-idempotency-key':prefix+'remote'},data:{...body,status:'Не подходит'}});expect(changed.ok(),await changed.text()).toBe(true);
  await route.fulfill({status:409,json:{ok:false,error:'version_conflict'}});
 },{times:1});
 await page.locator(`[data-card="${id}"]`).dragTo(column(page,'Квалифицирован').locator('.stage-heading'));
 await expect(column(page,'Не подходит').locator(`[data-card="${id}"]`)).toBeEnabled();
 await expect(page.locator('#crmSummary .card').first().locator('.value')).toHaveText('0');
 await page.locator('#leadsBoard').evaluate(el=>el.scrollLeft=0);
 await page.locator(`[data-card="${id}"]`).dragTo(column(page,'В работе').locator('.stage-heading'));
 await expect(column(page,'В работе').locator(`[data-card="${id}"]`)).toBeEnabled();await page.reload();await page.locator('#search').fill(prefix);await expect(column(page,'В работе')).toContainText(prefix);
});
test('moving an older card into a paginated stage never skips or duplicates leads on more',async({page,request})=>{
 const prefix='pages-'+Date.now()+'-';await seed(request,prefix+'old-',1);await seed(request,prefix+'target-',30);
 const all=await(await request.get(api+'?q='+prefix+'target-')).json();
 for(const lead of all.leads){const r=await request.patch(api+'/leads/'+lead.id,{headers:{origin:'http://127.0.0.1:4173','x-idempotency-key':prefix+lead.id},data:{status:'В работе',version:lead.version}});expect(r.ok(),await r.text()).toBe(true);}
 await open(page,prefix);await expect(column(page,'В работе').locator('.lead-card')).toHaveCount(25);
 const id=await column(page,'Новый').locator('.lead-card').getAttribute('data-card');await page.locator(`[data-card="${id}"]`).dragTo(column(page,'В работе').locator('.stage-heading'));
 await expect(column(page,'В работе').locator(`[data-card="${id}"]`)).toBeEnabled();await expect(column(page,'В работе').locator('.lead-card')).toHaveCount(26);
 await column(page,'В работе').locator('[data-more]').click();await expect(column(page,'В работе').locator('.lead-card')).toHaveCount(31);
 expect(await page.locator('.lead-card').evaluateAll(els=>new Set(els.map(el=>el.dataset.card)).size)).toBe(31);
});
