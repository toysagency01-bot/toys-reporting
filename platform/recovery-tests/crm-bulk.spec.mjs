import {test,expect} from '@playwright/test';
const api='/api/v2/projects/housevip-cxp7/crm';
async function seed(request,prefix,n=3,boardId='default'){for(let i=0;i<n;i++){const r=await request.post(api,{headers:{origin:'http://127.0.0.1:4173','x-idempotency-key':prefix+i},data:{boardId,name:prefix+i,email:prefix+i+'@example.test'}});expect(r.ok(),await r.text()).toBe(true);}}
async function open(page,prefix){await page.goto('/api/v2/projects/housevip-cxp7/content-crm');const loaded=page.waitForResponse(r=>r.url().includes('/crm?')&&new URL(r.url()).searchParams.get('q')===prefix);await page.locator('#search').fill(prefix);await loaded;await expect(page.locator('#leadCount')).not.toHaveText('');}
test('select all includes unloaded matches, move persists, deletion requires confirmation and updates counters',async({page,request})=>{
 const prefix='bulk-all-'+Date.now()+'-';await seed(request,prefix,31);await open(page,prefix);await expect(page.locator('.lead-card')).toHaveCount(25);
 await page.locator('#selectLeads').click();await page.getByRole('button',{name:'Выбрать все найденные · 31',exact:true}).click();await expect(page.locator('[data-count]')).toHaveText('Выбрано: 31');
 await page.locator('.crm-bulk-actions [data-move]').click();const modal=page.getByRole('dialog',{name:'Массовое действие с лидами'});
 await modal.locator('[name=status]').selectOption('Квалифицирован');await modal.getByRole('button',{name:'Перенести',exact:true}).click();await expect(modal).not.toBeVisible();
 await expect(page.locator('#crmSummary .card').first().locator('.value')).toHaveText('31');await expect(page.locator('[data-stage="Квалифицирован"] .stage-count')).toHaveText('31');
 await page.reload();await page.locator('#search').fill(prefix);await expect(page.locator('#leadCount')).toHaveText('31');
 await page.locator('#selectLeads').click();await page.getByRole('button',{name:'Выбрать все найденные · 31',exact:true}).click();await page.locator('.crm-bulk-actions [data-delete]').click();
 await expect(modal).toContainText('Удалить выбранных лидов?');await modal.getByRole('button',{name:'Отмена',exact:true}).click();await expect(page.locator('#leadCount')).toHaveText('31');
 await page.locator('.crm-bulk-actions [data-delete]').click();await modal.getByRole('button',{name:'Удалить 31 лидов',exact:true}).click();await expect(modal).not.toBeVisible();await expect(page.locator('#leadCount')).toHaveText('0');await expect(page.locator('#crmSummary .card').first().locator('.value')).toHaveText('0');
});
test('sale transfer requests separate amounts, mobile selection stays usable and failures keep only failed leads selected',async({page,request})=>{
 const prefix='bulk-sale-'+Date.now()+'-';await seed(request,prefix,3);await page.setViewportSize({width:390,height:844});await open(page,prefix);await page.locator('#selectLeads').click();
 await page.locator('.kanban-column[data-stage="Новый"] .stage-select').check();await expect(page.locator('[data-count]')).toHaveText('Выбрано: 3');
 await page.locator('.crm-bulk-actions [data-move]').click();const modal=page.getByRole('dialog',{name:'Массовое действие с лидами'});await modal.locator('[name=status]').selectOption('Продажа');await expect(modal.locator('[data-sale]')).toHaveCount(3);
 await modal.getByRole('button',{name:'Перенести',exact:true}).click();await expect(modal).toBeVisible();
 const rows=modal.locator('[data-sale]');for(let i=0;i<3;i++){await rows.nth(i).locator('[data-value]').fill(String((i+1)*100));await rows.nth(i).locator('[data-currency]').fill('EUR');}
 const failedId=await rows.nth(1).getAttribute('data-sale');
 await page.route('**/crm/leads/'+failedId,r=>r.request().method()==='PATCH'?r.fulfill({status:409,json:{ok:false,error:'version_conflict'}}):r.continue(),{times:1});
 expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.screenshot({path:'/tmp/crm-bulk-mobile.png'});
 await modal.getByRole('button',{name:'Перенести',exact:true}).click();await expect(modal.locator('.bulk-progress')).toContainText('Не удалось подтвердить: 1',{timeout:20000});await expect(page.locator('[data-count]')).toHaveText('Выбрано: 1');
 await modal.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(page.locator('#crmSummary .card').nth(1).locator('.value')).toHaveText('2');await expect(page.locator('#crmSummary .card').nth(2).locator('.value')).toHaveText('400 EUR');
 await page.locator('#search').fill('no-such-contact');await expect(page.locator('.crm-bulk-actions')).toBeHidden();
});
test('board settings rename and reorder stages, transfer occupied removed columns and retain history',async({page,request})=>{
 const prefix='board-edit-'+Date.now()+'-';const templates=await(await request.get(api+'/boards')).json();const created=await request.post(api+'/boards',{headers:{origin:'http://127.0.0.1:4173','x-idempotency-key':prefix+'board'},data:{name:prefix,stages:templates.templates.find(t=>t.key==='general').stages}});expect(created.ok()).toBe(true);const board=(await created.json()).board;await seed(request,prefix,2,board.id);await page.addInitScript(id=>sessionStorage.setItem('toys-crm-board:housevip-cxp7',id),board.id);await open(page,prefix);
 await page.locator('#boardTrigger').click();await page.locator('#editBoard').click();await expect(page.locator('#boardForm')).toBeVisible();
 await page.locator('#boardForm [name=name]').fill('Продажи QA');await page.getByRole('textbox',{name:'Название этапа 1',exact:true}).fill('Входящие QA');
 await page.getByRole('textbox',{name:'Название этапа 2',exact:true}).fill('Контакт QA');await page.getByRole('button',{name:'Опустить этап 2',exact:true}).click();
 await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();await expect(page.locator('#editor')).not.toBeVisible();await expect(page.locator('#funnelName')).toHaveText('Продажи QA');await expect(page.locator('[data-stage="Входящие QA"]')).toContainText(prefix);
 await page.locator('#boardTrigger').click();await page.locator('#editBoard').click();await page.getByRole('button',{name:'Удалить этап 1',exact:true}).click();
 await page.getByRole('combobox',{name:'Куда перенести лидов из Входящие QA',exact:true}).selectOption('Квалифицирован');
 // The first remaining stage must be ordinary: move the ordinary contact up.
 await page.getByRole('button',{name:'Поднять этап 2',exact:true}).click();
 await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();await expect(page.locator('#editor')).not.toBeVisible();await expect(page.locator('[data-stage="Входящие QA"]')).toHaveCount(0);await expect(page.locator('[data-stage="Квалифицирован"] .stage-count')).toHaveText('2');
 await page.reload();await expect(page.locator('#funnelName')).toHaveText('Продажи QA');await expect(page.locator('[data-stage="Квалифицирован"]')).toContainText(prefix);
 await page.setViewportSize({width:390,height:844});await page.locator('#boardTrigger').click();await page.locator('#editBoard').click();expect(await page.locator('#editor').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.screenshot({path:'/tmp/crm-board-settings-mobile.png'});
});
test('bulk transfer to another board affects only the filtered selection and clears selection on board change',async({page,request})=>{
 const prefix='cross-bulk-'+Date.now()+'-';await seed(request,prefix,2);await seed(request,'unrelated-'+prefix,1);
 const templates=await(await request.get(api+'/boards')).json();const template=templates.templates.find(t=>t.key==='general').stages.map(s=>({...s,label:s.kind==='qualified'?'Квал отдела':s.label}));
 const created=await request.post(api+'/boards',{headers:{origin:'http://127.0.0.1:4173','x-idempotency-key':prefix+'board'},data:{name:'Отдел '+prefix,stages:template}});expect(created.ok()).toBe(true);const board=(await created.json()).board;
 // Match two exact emails so a similarly named unrelated contact is excluded.
 await open(page,prefix);const all=await page.locator('.lead-card').count();expect(all).toBe(3);
 await page.locator('#selectLeads').click();const checks=page.locator('[data-select-lead]');
 for(let i=0;i<await checks.count();i++){const label=await checks.nth(i).getAttribute('aria-label');if(!label.includes('unrelated-'))await checks.nth(i).check();}
 await expect(page.locator('[data-count]')).toHaveText('Выбрано: 2');await page.locator('.crm-bulk-actions [data-move]').click();const modal=page.getByRole('dialog',{name:'Массовое действие с лидами'});
 await modal.locator('[name=boardId]').selectOption(board.id);await modal.locator('[name=status]').selectOption('Квал отдела');await modal.getByRole('button',{name:'Перенести',exact:true}).click();await expect(modal).not.toBeVisible();await expect(page.locator('#leadCount')).toHaveText('1');
 await page.locator('#boardTrigger').click();await page.locator(`[data-board="${board.id}"][role=menuitemradio]`).click();await expect(page.locator('.crm-bulk-actions')).toBeHidden();await expect(page.locator('#leadCount')).toHaveText('2');await expect(page.locator('#crmSummary .card').first().locator('.value')).toHaveText('2');
 await page.screenshot({path:'/tmp/crm-bulk-desktop.png'});
});
