import {test,expect} from '@playwright/test';
const key='a'.repeat(64);
async function campaigns(page,{client=false,failure=false}={}){
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 const state={posts:0,gets:0,status:'PAUSED'};
 await page.route('**/campaign-browser?*',r=>r.fulfill({json:{ok:true,rows:[{key,name:'Рекламная кампания Meta — длинное название для проверки телефона',level:'campaign',provider:'meta_ads',currency:'EUR',status:'ACTIVE',childCount:0,history:false,metrics:{spend:100,conversions:5}}],total:1,nextOffset:null,sources:[]}}));
 if(!client)await page.route('**/campaign-control',r=>r.fulfill({json:{ok:true,canManage:true,providers:['meta_ads']}}));
 await page.route('**/campaign-browser/*/status?*',async r=>{
  if(r.request().method()==='POST'){state.posts++;expect(r.request().postDataJSON()).toEqual({status:'ACTIVE',expectedStatus:'PAUSED'});await new Promise(resolve=>setTimeout(resolve,120));if(failure)return r.fulfill({json:{ok:true,operation:{state:'uncertain',error:'meta_unavailable'}}});state.status='ACTIVE';return r.fulfill({json:{ok:true,current:{name:'Подтверждённая кампания',status:state.status,checkedAt:new Date().toISOString()},operation:{state:'succeeded'}}});}
  state.gets++;return r.fulfill({json:{ok:true,projectName:'HOUSEVIP',current:{name:'Подтверждённая кампания',status:state.status,effectiveStatus:state.status,checkedAt:new Date().toISOString()},canChange:true}});
 });
 return state;
}
for(const width of [1440,390])test(`campaign control fresh status, confirmation, single write and focus return at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));const state=await campaigns(page);
 await page.goto('/housevip-cxp7/');await page.locator('[data-ux-view=campaigns]').click();const control=page.getByRole('button',{name:/Управлять кампанией/});await expect(control).toBeVisible();expect(state.gets).toBe(0);expect(state.posts).toBe(0);
 await control.click();const dialog=page.locator('.campaign-control-dialog');await expect(dialog).toBeVisible();await expect(dialog).toContainText('На паузе');await expect(dialog).toContainText('расход бюджета');await expect(dialog).toContainText('HOUSEVIP');expect(state.posts).toBe(0);
 const confirm=dialog.getByRole('button',{name:'Включить кампанию',exact:true});await expect(confirm).toBeEnabled();await page.screenshot({path:`/tmp/toys-campaign-controls-${width}.png`});await confirm.click();await expect(dialog).toContainText('Кампания включена.');expect(state.posts).toBe(1);await expect(dialog.locator('[data-confirm]')).toBeDisabled();
 await dialog.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(control).toBeFocused();await expect(page.locator('.campaign-name')).toContainText('Активно');expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
test('ambiguous campaign result never silently retries or reports success',async({page})=>{
 const state=await campaigns(page,{failure:true});await page.goto('/housevip-cxp7/');await page.locator('[data-ux-view=campaigns]').click();await page.getByRole('button',{name:/Управлять кампанией/}).click();const dialog=page.locator('.campaign-control-dialog');await dialog.getByRole('button',{name:'Включить кампанию',exact:true}).click();await expect(dialog).toContainText('Результат пока не подтверждён');await expect(dialog.locator('[data-confirm]')).toBeDisabled();expect(state.posts).toBe(1);await expect(dialog.getByRole('button',{name:'Закрыть',exact:true})).toBeEnabled();
});
test('clients see campaign statistics without controls',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-role':'client'});await campaigns(page,{client:true});await page.goto('/housevip-cxp7/');await page.locator('[data-ux-view=campaigns]').click();await expect(page.locator('.campaign-name')).toBeVisible();await expect(page.getByRole('button',{name:/Управлять кампанией/})).toHaveCount(0);
});
for(const width of [1440,390,320])test(`admin journal filters, expands report/CRM changes and fits ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/master/#audit');await expect(page.locator('#auditNav')).toBeVisible();await expect(page.locator('#audit .audit-event').first()).toBeVisible();
 await page.locator('#audit .audit-event').first().locator('summary').click();await expect(page.locator('#audit .audit-details').first()).toContainText('До');
 await page.locator('#audit [name=category]').selectOption('reports');await page.locator('#audit').getByRole('button',{name:'Показать',exact:true}).click();await expect(page.locator('#audit .audit-event').first()).toBeVisible();
 await page.locator('#audit [name=actor]').fill('nonexistent@example.test');await page.locator('#audit').getByRole('button',{name:'Показать',exact:true}).click();await expect(page.locator('.audit-status')).toContainText('событий нет');await page.locator('#audit').getByRole('button',{name:'Сбросить',exact:true}).click();await expect(page.locator('.audit-event').first()).toBeVisible();
 await page.locator('.audit-event').first().locator('summary').click();await expect(page.locator('.audit-details').first()).toContainText('До');await page.screenshot({path:`/tmp/toys-audit-${width}.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);expect(errors).toEqual([]);
});
test('team does not see admin history navigation and hash cannot open it',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-role':'team'});await page.goto('/master/#audit');await expect(page.locator('#heading')).toHaveText('Мои проекты');await expect(page.locator('#auditNav')).toBeHidden();await expect(page.locator('#audit')).toBeHidden();const response=await page.request.get('/api/v2/master/audit',{headers:{'x-test-role':'team'}});expect(response.status()).toBe(403);
});
