import {test,expect} from '@playwright/test';
async function open(page){await page.goto('/master/');await expect(page.locator('#projectSelect option').filter({hasText:'Synthetic Brief Project'})).toHaveCount(1);await page.locator('#projectSelect').selectOption({label:'Synthetic Brief Project'});await expect(page.locator('.onboarding-dialog')).toBeVisible();}
test('brief project opens a complete private card and launch checklist, escaping submitted markup',async({page})=>{
 const dialogs=[];page.on('dialog',d=>{dialogs.push(d.message());d.dismiss();});await open(page);
 await expect(page.locator('.onboarding-dialog').getByRole('heading',{name:'Synthetic Brief Project',exact:true})).toBeVisible();await expect(page.locator('[data-task]')).toHaveCount(11);
 await expect(page.locator('.onboarding-links').getByRole('link',{name:'Папка проекта ↗'})).toHaveAttribute('href',/synthetic_drive_folder_id_123/);
 await page.locator('.onboarding-profile>summary').click();await expect(page.locator('.onboarding-profile')).toContainText('Synthetic service <img');expect(await page.locator('.onboarding-profile img').count()).toBe(0);expect(dialogs).toEqual([]);
 await page.screenshot({path:'dist/onboarding-project.png',fullPage:true});
});
test('deadlines, owners and verified completion persist; completed connections require evidence',async({page})=>{
 await open(page);await page.locator('[data-task=plan]>summary').click();await page.locator('[name=deadline-plan]').fill('2026-11-10');await page.locator('[name=owner-plan]').fill('Synthetic buyer');
 await page.locator('[data-task=capi]>summary').click();await page.locator('[name=state-capi]').selectOption('done');await page.getByRole('button',{name:'Сохранить подготовку',exact:true}).click();await expect(page.locator('[data-status]')).toContainText('результатом проверки');
 await page.locator('[name=note-capi]').fill('Synthetic event received and deduplication verified');await page.getByRole('button',{name:'Сохранить подготовку',exact:true}).click();await expect(page.locator('[data-status]')).toContainText('Подготовка сохранена');
 await page.reload();await page.locator('#projectSelect').selectOption({label:'Synthetic Brief Project'});await expect(page.locator('.onboarding-dialog')).toBeVisible();expect(await page.locator('[name=deadline-plan]').inputValue()).toBe('2026-11-10');expect(await page.locator('[name=owner-plan]').inputValue()).toBe('Synthetic buyer');expect(await page.locator('[name=state-capi]').inputValue()).toBe('done');
});
test('dirty editor confirms closing and mobile layout fits without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);await page.locator('[data-task=brief]>summary').click();await page.locator('[name=owner-brief]').fill('Synthetic');
 page.once('dialog',d=>d.dismiss());await page.keyboard.press('Escape');await expect(page.locator('.onboarding-dialog')).toBeVisible();
 expect(await page.locator('.onboarding-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:'dist/onboarding-mobile.png',fullPage:true});
 page.once('dialog',d=>d.accept());await page.keyboard.press('Escape');await expect(page.locator('.onboarding-dialog')).not.toBeVisible();
});
test('assigned buyer can prepare the project but cannot retrieve the source token',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-role':'team'});await open(page);await page.getByRole('button',{name:'Закрыть подготовку'}).click();await expect(page.locator('#briefSourceSetup')).toBeHidden();const setup=await page.request.get('/api/v2/master/brief-source/setup',{headers:{'x-test-role':'team'}});expect(setup.status()).toBe(403);
});
test('unassigned staff cannot access the private onboarding record',async({page})=>{
 await page.goto('/master/');const projects=await(await page.request.get('/api/v2/master')).json();const slug=projects.projects.find(p=>p.onboarding).slug;
 await page.setExtraHTTPHeaders({'x-test-role':'empty'});const response=await page.request.get('/api/v2/master/projects/'+slug+'/onboarding',{headers:{'x-test-role':'empty'}});expect(response.status()).toBe(403);const limited=await(await page.request.get('/api/v2/master',{headers:{'x-test-role':'empty'}})).json();expect(limited.projects.some(p=>p.slug===slug)).toBe(false);
});
test('source setup provides a credential-free Apps Script to administrators',async({page})=>{
 await page.goto('/master/');await page.getByRole('button',{name:'Подключить брифы',exact:true}).click();await expect(page.getByRole('heading',{name:'Подключить брифы',exact:true})).toBeVisible();const script=await page.locator('[data-script]').inputValue();expect(script).toContain('setupTOYSBriefIntake');expect(script).not.toContain('synthetic-onboarding-token');await expect(page.getByRole('button',{name:'Скопировать ключ',exact:true})).toBeVisible();
});
test('project details can be clarified while the original submitted brief stays unchanged',async({page})=>{
 await open(page);await page.locator('.onboarding-profile>summary').click();await page.locator('[name=profile-companyName]').fill('Synthetic Brief Project clarified');await page.locator('[name=profile-budget]').fill('500 EUR per month');
 await page.getByRole('button',{name:'Сохранить подготовку',exact:true}).click();await expect(page.locator('[data-status]')).toContainText('Подготовка сохранена');await expect(page.locator('.onboarding-dialog h2')).toHaveText('Synthetic Brief Project clarified');
 const projects=await(await page.request.get('/api/v2/master')).json(),p=projects.projects.find(p=>p.onboarding);const card=await(await page.request.get('/api/v2/master/projects/'+p.slug+'/onboarding')).json();expect(card.profile.companyName).toBe('Synthetic Brief Project clarified');expect(card.profile.budget).toBe('500 EUR per month');expect(card.answers.find(a=>a.question==='Название проекта').answer).toBe('Synthetic Brief Project');
});
test('manual plan card shows source dates and keeps wide task tables inside the mobile dialog',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/api/v2/master/projects/*/onboarding',async route=>{
  const response=await route.fetch();const data=await response.json();
  data.sourceKind='project-plan';data.sourceUrl='https://docs.google.com/spreadsheets/d/synthetic-plan/edit#gid=42';
  data.plan={table:{cols:['Этап','Задача','Срок','Ответственный','Статус'].map(label=>({label})),rows:[{c:['Запуск','Synthetic long launch task <script>alert(1)</script>','02.11.2026','Media buyer (Meta)','План'].map(v=>({v}))}]}};
  await route.fulfill({response,json:data});
 });
 await open(page);await expect(page.getByRole('link',{name:'Проектная таблица ↗'})).toHaveAttribute('href',/synthetic-plan/);
 await expect(page.locator('.onboarding-plan-scroll')).toContainText('02.11.2026');await expect(page.locator('.onboarding-plan-scroll script')).toHaveCount(0);
 expect(await page.locator('.onboarding-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
 await page.screenshot({path:'dist/onboarding-manual-plan-mobile.png',fullPage:true});
});
