import {selectNovaSection} from './nova-browser-helpers.mjs';
import {test,expect} from '@playwright/test';
for(const slug of ['housevip-cxp7','bs-clinic-a5b4','profkit-instashop-r4vk'])test(slug+' section menu supports native tabs and ordinary desktop/mobile navigation',async({page,context,request})=>{
 await context.addInitScript(()=>{const OriginalDate=Date,fixed=Date.parse('2026-10-08T06:07:00Z');globalThis.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};});
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
 const data=await(await request.get('/api/v2/projects/housevip-cxp7/dashboard')).json();data.dashboard.project.slug=slug;
 const metric=(metricCode,value,currency=null)=>({metricCode,value:String(value),state:'observed',currency});
 if(slug.includes('instashop'))data.dashboard.instashop={ads:{rows:[{...data.dashboard.facts.rows[0],metrics:[metric('ads.spend_uah',410,'UAH'),metric('ads.impressions',1000),metric('ads.clicks',25),metric('instashop.meta_direct',4)]}]},sales:{rows:[{date:data.dashboard.facts.rows[0].date,metrics:[metric('instashop.sales_count',2),metric('instashop.revenue_uah',1000,'UAH'),metric('instashop.direct_inquiries',10),metric('instashop.qualified_inquiries',8),metric('instashop.unqualified_inquiries',2)]}]}};
 await context.route('**/projects/'+slug+'/dashboard*',r=>r.fulfill({json:data}));
 await context.route('**/projects/'+slug+'/content/tabs*',r=>r.fulfill({json:{ok:true,tabs:[]}}));
 await context.route('**/projects/'+slug+'/content/reports',r=>r.fulfill({json:{ok:true,reports:[],canEdit:true,canDelete:true}}));
 await context.route('**/projects/'+slug+'/weekly-reports',r=>r.fulfill({json:{ok:true,reports:[]}}));
 await page.setViewportSize({width:1440,height:1000});await page.goto('/'+slug+'/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 const marker=await page.evaluate(()=>window.sectionNavigationMarker=crypto.randomUUID());
 const views=await page.locator('#uxNav a[data-ux-view]').evaluateAll(links=>links.map(a=>a.dataset.uxView));
 expect(views).toEqual(expect.arrayContaining(['overview','campaigns','funnel','weekly','project']));
 await expect(page.locator('#uxNav button[data-ux-view]')).toHaveCount(0);
 const panel=view=>page.locator(view==='project'?(slug.includes('instashop')?'#uxProject':'#projectView'):'#ux'+view[0].toUpperCase()+view.slice(1));
 for(const view of views.filter(v=>v!=='leads')){
  const link=page.locator(`#uxNav a[data-ux-view="${view}"]`);await expect(link).toHaveAttribute('href','#'+view);
  expect(await link.evaluate(el=>{const event=new MouseEvent('contextmenu',{button:2,bubbles:true,cancelable:true});el.dispatchEvent(event);return event.defaultPrevented;})).toBe(false);
  await link.click();await expect(panel(view)).toBeVisible();expect(await page.evaluate(()=>window.sectionNavigationMarker)).toBe(marker);
  // Loading the actual menu URL in a fresh tab must restore the selected view.
  const url=await link.getAttribute('href'),tab=await context.newPage();await tab.goto('/'+slug+'/'+url);await expect(tab.locator('body')).toHaveAttribute('data-platform-ready','true');
  const selected=tab.locator(`#uxNav [data-ux-view="${view}"]`);await expect(selected).toHaveClass(/active/);await tab.close();
 }
 await page.locator('#uxNav [data-ux-view=overview]').click();const before=page.url();
 for(const [view,options] of [['campaigns',{button:'middle'}],['weekly',{modifiers:['Control']}]]){
  const popup=context.waitForEvent('page');await page.locator(`#uxNav [data-ux-view=${view}]`).click(options);const tab=await popup;await expect(tab.locator('body')).toHaveAttribute('data-platform-ready','true');await expect(tab.locator(`#uxNav [data-ux-view=${view}]`)).toHaveClass(/active/);expect(page.url()).toBe(before);await tab.close();
 }
 await page.screenshot({path:'/tmp/toys-section-menu-'+slug+'-desktop.png'});
 await page.setViewportSize({width:390,height:844});await selectNovaSection(page,'campaigns');await expect(panel('campaigns')).toBeVisible();await selectNovaSection(page,'weekly');await expect(panel('weekly')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/toys-section-menu-'+slug+'-mobile.png'});expect(errors).toEqual([]);
});
