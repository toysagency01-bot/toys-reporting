import {test,expect} from '@playwright/test';
for(const width of [1440,390])test(`admin sales demo dashboard, reports and CRM work at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/nova-sales-demo/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await expect(page.locator('#salesDemoNotice')).toBeVisible();await expect(page.locator('#platformCRMStats')).toContainText('822');await expect(page.locator('#platformCRMStats')).toContainText('203');await expect(page.locator('#platformCRMStats')).toContainText('313');
 const groups=page.locator('#clientMetricGroups>.client-metric-group');await expect(groups.locator('h2')).toHaveText(['Реклама','Лиды и квалификация','Продажи CRM']);expect(await groups.evaluateAll(nodes=>nodes.map(n=>(n.getAttribute('aria-owns')||'').split(' ').length))).toEqual([4,4,4]);await expect(page.locator('#clientMetricGroups .card:visible')).toHaveCount(12);await expect(page.locator('#clientMetricGroups .label svg:visible')).toHaveCount(0);
 await expect(page.locator('#platformCRMMethod,#platformCRMDateBasis')).toHaveCount(0);
 if(width<=760){
  for(const phone of [360,390,430]){
   await page.setViewportSize({width:phone,height:744});
   const layout=await page.evaluate(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect();return {header:rect('body>header').height,first:rect('#clientMetricGroups .card').top,groups:rect('#clientMetricGroups').bottom,insight:rect('#uxOverview>.ux-insight').top,select:rect('#clientSectionSelect').height,theme:rect('#toysThemeToggle').height,account:rect('#platformMobileAccount').height};});
   expect(layout.header).toBeLessThan(115);expect(layout.first).toBeLessThan(500);expect(layout.insight).toBeGreaterThanOrEqual(layout.groups);for(const key of ['select','theme','account'])expect(layout[key]).toBeGreaterThanOrEqual(44);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await page.setViewportSize({width,height:900});await page.locator('#toysThemeToggle').click();await page.screenshot({path:'/tmp/toys-mobile-dashboard-light.png',animations:'disabled'});await page.locator('#toysThemeToggle').click();
 }
 await page.screenshot({path:`/tmp/toys-sales-demo-dashboard-${width}.png`,fullPage:true,animations:'disabled'});
 if(width<=760)await page.locator('#clientSectionSelect').selectOption('funnel');else await page.locator('[data-ux-view=funnel]' ).click();await expect(page.locator('#demoSalesFunnel [data-stage=sales]')).toContainText('203');await expect(page.locator('#demoSalesFunnel')).toContainText('58,05%');await expect(page.locator('#demoSalesFunnel')).toContainText('24,7%');await page.screenshot({path:`/tmp/toys-sales-funnel-${width}.png`,fullPage:true});
 if(width<=760)await page.locator('#clientSectionSelect').selectOption('campaigns');else await page.locator('[data-ux-view=campaigns]' ).click();await expect(page.locator('.campaign-entity')).toHaveCount(5);await expect(page.locator('.campaign-entity').first()).toContainText('Продажи');await expect(page.locator('.campaign-entity').first()).toContainText('Выручка CRM');await page.screenshot({path:`/tmp/toys-sales-campaigns-${width}.png`,fullPage:true});
 if(width<=760)await page.locator('#clientSectionSelect').selectOption('weekly');else await page.locator('[data-ux-view=weekly]' ).click();await expect(page.locator('#weeklyContent')).toBeVisible();await expect(page.locator('#weeklyContent')).toContainText('ДЕМО');
 if(width<=760)await page.locator('#clientSectionSelect').selectOption('project');else await page.locator('[data-ux-view=project]' ).click();await expect(page.locator('#projectView')).toContainText('О проекте');await expect(page.locator('#projectView')).not.toContainText('Сценарий демонстрации');
 await page.locator('#platformCRMNav').click();await expect(page.locator('#platformClientCRM #leadCount')).toContainText('1');await expect(page.locator('#platformClientCRM .kanban-column').first()).toBeVisible();
 const crm=page.locator('#platformClientCRM');await crm.locator('#search').fill('Демо-клиент 0001');await expect(crm.locator('.lead-card')).toHaveCount(1);await crm.locator('.lead-card').first().click();await expect(crm.locator('#editor')).toBeVisible();await expect(crm.locator('#editor')).toContainText('Демо-клиент 0001');await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);expect(errors).toEqual([]);
});
test('demo is excluded from agency totals and private for team and client',async({page})=>{
 await page.goto('/master/');await expect(page.locator('#projectsTable')).toContainText('NOVA Business Services');await expect(page.locator('#metrics')).not.toContainText('24 100');await expect(page.locator('#metrics')).not.toContainText('313 930');
 for(const role of ['team','client']){await page.setExtraHTTPHeaders({'x-test-role':role});const response=await page.goto('/nova-sales-demo/');expect(response.status()).toBe(403);await expect(page.locator('#salesDemoNotice')).toHaveCount(0);}
});

test('demo channel filters keep the funnel, CRM cards and campaign sales consistent',async({page})=>{
 await page.goto('/nova-sales-demo/');await expect(page.locator('#demoSalesFunnel [data-stage=sales] b')).toHaveText('203');await page.locator('[data-ux-view=funnel]').click();await page.locator('#platformSeg [data-platform="Google Ads"]').click();await expect(page.locator('#demoSalesFunnel [data-stage=sales] b')).toHaveText('23');
 await page.locator('[data-ux-view=overview]').click();const sales=page.locator('#platformCRMStats .card').filter({has:page.getByText('Продажи CRM',{exact:true})});await expect(sales.locator('.value')).toHaveText('23');
 await page.locator('[data-ux-view=campaigns]').click();await expect(page.locator('.campaign-entity')).toHaveCount(2);await expect(page.locator('.campaign-name').filter({hasText:'Meta'})).toHaveCount(0);
 await page.locator('#platformSeg button').first().click();await expect(page.locator('.campaign-entity')).toHaveCount(5);await expect(page.locator('#demoSalesFunnel [data-stage=sales] b')).toHaveText('203');
});

test('a new CRM qualification updates cached funnel and campaign metrics on returning to the dashboard',async({page})=>{
 await page.goto('/nova-sales-demo/');await expect(page.locator('#demoSalesFunnel [data-stage=qualifiedLeads] b')).toHaveText('822');await page.locator('[data-ux-view=campaigns]').click();await expect(page.locator('.campaign-entity')).toHaveCount(5);
 await page.locator('#platformCRMNav').click();const crm=page.locator('#platformClientCRM');await crm.locator('.kanban-column[data-stage="Новые"] .lead-card').first().click();await expect(crm.locator('#editor')).toBeVisible();await crm.locator('#leadForm [name=status]').selectOption('Квалифицирован');await crm.locator('#leadForm').getByRole('button',{name:'Сохранить',exact:true}).click();await expect(crm.locator('#editor')).toBeHidden();await page.locator('#platformHomeNav').click();await expect(page.locator('#demoSalesFunnel [data-stage=qualifiedLeads] b')).toHaveText('823');
});

test('touch phone first screen keeps results visible and the native section selector usable',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:700},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const page=await context.newPage();await page.goto('/nova-sales-demo/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await expect(page.locator('#clientMetricGroups .card').first()).toBeInViewport({ratio:1});await expect(page.locator('#platformCRMMethod')).toHaveCount(0);
 expect(await page.locator('#clientSectionSelect').evaluate(e=>getComputedStyle(e).fontSize)).toBe('16px');
 await page.screenshot({path:'/tmp/toys-mobile-touch-dark.png',animations:'disabled'});
 await page.locator('#clientSectionSelect').selectOption('weekly');await expect(page.locator('#weeklyContent')).toBeVisible();await expect(page.locator('#controls')).toBeHidden();
 await page.locator('#clientSectionSelect').selectOption('overview');await expect(page.locator('#clientMetricGroups')).toBeVisible();await page.locator('#toysThemeToggle').click();
 await page.screenshot({path:'/tmp/toys-mobile-touch-light.png',animations:'disabled'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await context.close();
});
