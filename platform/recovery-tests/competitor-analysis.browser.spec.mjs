import {test,expect} from '@playwright/test';
async function open(page){await page.goto('/reviews-plus/#meta');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await page.getByRole('button',{name:'Анализ конкурентов',exact:true}).click();await expect(page.locator('.ca-analysis')).toBeVisible();}
test('desktop analysis shows comparison, conclusions and all trailing sections, with readable evidence and in-page navigation',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await open(page);
 await expect(page.locator('.ca-overview')).toContainText('First conclusion');await expect(page.locator('.ca-analysis tbody td').first()).toContainText('Synthetic Trustpilot service');expect(await page.locator('.ca-analysis tbody td').first().evaluate(e=>getComputedStyle(e).whiteSpace)).toBe('normal');await expect(page.locator('.ca-card')).toHaveCount(2);
 for(const value of ['Additional competitor retained','Mismatch retained','Method retained'])await expect(page.locator('.ca-analysis')).toContainText(value);
 const beforeHash=new URL(page.url()).hash;await page.locator('.ca-analysis table').getByRole('link',{name:'Alpha',exact:true}).click();await expect(page.locator('#competitor-1')).toBeFocused();expect(new URL(page.url()).hash).toBe(beforeHash);
 const sources=page.locator('#competitor-1 .ca-sources');await expect(sources.locator('div')).toBeHidden();await sources.locator('summary').click();await expect(sources.locator('div')).toContainText('A source note');await expect(sources.getByRole('link')).toHaveAttribute('href','https://source.example.test/');
 expect(await page.locator('.ca-prose').first().evaluate(e=>getComputedStyle(e).fontSize)).toBe('16px');
 await page.screenshot({path:'dist/competitors-readable-desktop.png',fullPage:true});
});
test('mobile analysis fits the page and keeps the comparison table inside its own scroll area',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.locator('.ca-table-scroll').evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);
 await expect(page.locator('.ca-extra')).toHaveCount(2);await page.screenshot({path:'dist/competitors-readable-mobile.png',fullPage:true});
});
