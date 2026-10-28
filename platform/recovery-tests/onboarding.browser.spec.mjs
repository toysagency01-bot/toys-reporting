import {test,expect} from '@playwright/test';
test('master preparation task popup stays disabled when selecting an onboarding project',async({page})=>{
 await page.goto('/master/');await page.locator('#projectSelect').selectOption({label:'Synthetic Brief Project'});
 await expect(page.locator('#projectFeatures')).toContainText('Synthetic Brief Project');
 await expect(page.locator('.onboarding-dialog')).not.toBeVisible();await expect(page.locator('[data-onboarding]')).toHaveCount(0);
 const projects=await(await page.request.get('/api/v2/master')).json(),p=projects.projects.find(p=>p.onboarding);
 const card=await(await page.request.get('/api/v2/master/projects/'+p.slug+'/onboarding')).json();expect(card.tasks).toHaveLength(11);expect(card.answers.length).toBeGreaterThan(0);
});
test('assigned buyer can select preparation projects without opening the retired task popup',async({page})=>{
 await page.setExtraHTTPHeaders({'x-test-role':'team'});await page.goto('/master/');await page.locator('#projectSelect').selectOption({label:'Synthetic Brief Project'});
 await expect(page.locator('.onboarding-dialog')).not.toBeVisible();await expect(page.locator('[data-onboarding]')).toHaveCount(0);await expect(page.locator('#briefSourceSetup')).toBeHidden();
});
test('source setup remains available to administrators independently of the disabled task popup',async({page})=>{
 await page.goto('/master/');await page.getByRole('button',{name:'Подключить брифы',exact:true}).click();await expect(page.getByRole('heading',{name:'Подключить брифы',exact:true})).toBeVisible();
 const script=await page.locator('[data-script]').inputValue();expect(script).toContain('setupTOYSBriefIntake');expect(script).not.toContain('synthetic-onboarding-token');
});
