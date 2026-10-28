import {test,expect} from '@playwright/test';
test('Reviews Plus opens its usual dashboard with Meta subpages and the imported plan',async({page})=>{
 await page.goto('/reviews-plus/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await expect(page.getByText('Reviews Plus',{exact:true}).first()).toBeVisible();
 await page.screenshot({path:'dist/reviews-plus-dashboard.png',fullPage:true});
 await page.goto('/reviews-plus/#meta');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await expect(page.getByText('Synthetic launch task',{exact:true})).toBeVisible();
 await expect(page.getByText('до 02.11.2026 · Media buyer (Meta)',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Стратегия',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Креативный бриф',exact:true})).toBeVisible();
 await page.screenshot({path:'dist/reviews-plus-plan.png',fullPage:true});
 await page.getByRole('button',{name:'Месячная сводка',exact:true}).click();
 await expect(page.locator('#gWrap')).toContainText('Synthetic campaign');await expect(page.locator('#gWrap')).toContainText('120.50');
 await expect(page.getByRole('button',{name:'Google',exact:true})).toHaveCount(0);
 await expect(page.locator('#platformSeg [data-platform="Google Ads"]')).toHaveCount(0);
});
test('master opens the normal dashboard link and does not show a task popup',async({page})=>{
 await page.goto('/master/');await page.locator('#projectSelect').selectOption({label:'Reviews Plus'});
 await expect(page.getByRole('link',{name:'Открыть дашборд'})).toHaveAttribute('href','/reviews-plus/');
 await expect(page.locator('.onboarding-dialog')).not.toBeVisible();await expect(page.locator('[data-onboarding]')).toHaveCount(0);
});
test('campaigns, funnel, weekly reports and CRM open as ordinary project sections',async({page})=>{
 for(const hash of ['campaigns','funnel','weekly']){
  await page.goto('/reviews-plus/#'+hash);await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
  await expect(page.locator('body')).not.toContainText('Не удалось загрузить борд');
 }
 await page.goto('/api/v2/projects/reviews-plus/content-crm');await expect(page.getByRole('button',{name:'Добавить лида',exact:true})).toBeVisible();
});
