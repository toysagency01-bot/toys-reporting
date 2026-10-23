import {test,expect} from '@playwright/test';
for(const slug of ['housevip-cxp7','bs-clinic-a5b4','profkit-instashop-r4vk','karlovarska-sul-k4rm'])test(slug+' has compact usable metrics and campaign details without extra data reads',async({page,request})=>{
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const data=await(await request.get('/api/v2/projects/housevip-cxp7/dashboard')).json();data.dashboard.project.slug=slug;
 const m=(metricCode,value,currency=null)=>({metricCode,value:String(value),state:'observed',currency}),row=data.dashboard.facts.rows[0];
 if(slug.includes('instashop'))data.dashboard.instashop={ads:{rows:[{...row,metrics:[m('ads.spend_uah',410,'UAH'),m('ads.impressions',1000),m('ads.clicks',25),m('instashop.meta_direct',4)]}]},sales:{rows:[{date:row.date,metrics:[m('instashop.sales_count',2),m('instashop.revenue_uah',1000,'UAH'),m('instashop.direct_inquiries',10),m('instashop.qualified_inquiries',8),m('instashop.unqualified_inquiries',2)]}]}};
 if(slug.startsWith('karl')){data.dashboard.advertising={channels:{meta:data.dashboard.facts,google:data.dashboard.facts}};const rows=[{date:row.date,platform:'Meta Ads',metrics:[m('ecom.purchases',2),m('ecom.purchase_value',200,'EUR'),m('ecom.add_to_cart',5),m('ecom.checkout',3)]}];data.dashboard.ecommerce={account:{rows},campaigns:{rows:rows.map(r=>({...r,campaign:{label:'Synthetic campaign'}}))}};}
 await page.route('**/projects/'+slug+'/dashboard*',r=>r.fulfill({json:data}));
 await page.route('**/projects/'+slug+'/content/tabs*',r=>r.fulfill({json:{ok:true,tabs:[]}}));
 await page.route('**/projects/'+slug+'/crm/summary?*',r=>r.fulfill({json:{ok:true,available:true,qualified:3,sales:1,revenue:[{value:1000,currency:'EUR'}]}}));
 await page.route('**/projects/'+slug+'/weekly-reports',r=>r.fulfill({json:{ok:true,reports:[]}}));
 let campaignReads=0;await page.route('**/campaign-browser?*',r=>{campaignReads++;return r.fulfill({json:{ok:true,rows:[{key:'1'.padStart(64,'0'),name:'Synthetic campaign',provider:'meta_ads',currency:'EUR',level:'campaign',status:'ACTIVE',history:false,metrics:{spend:100,conversions:5,cpa:20,impressions:1000,clicks:25,ctr:2.5,purchases:2,roas:3}}],total:1,nextOffset:null,sources:[]}});});
 await page.setViewportSize({width:1440,height:1000});await page.goto('/'+slug+'/');await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');
 await page.getByRole('button',{name:'Максимум',exact:true}).click();await expect(page.locator('#uxInsightTitle')).toBeHidden();
 const cards=page.locator(slug.includes('instashop')?'#cards':'#mainCards'),extra=page.locator('#clientExtraMetrics');
 if(slug.startsWith('karl')){await expect(page.locator('#ecomTopCards .client-commerce-result')).toHaveCount(2);await expect(page.locator('#ecomTopCards .client-commerce-result').first()).toContainText('Покупки');await expect(page.locator('#ecomTopCards .client-commerce-result').first().locator('.value')).toContainText('2');}
 if(!slug.startsWith('karl')){
  await expect(cards.locator(':scope > .card:visible')).toHaveCount(slug.includes('instashop')?4:3);
  const before=await cards.locator('.value').allTextContents();await extra.click();await expect(extra).toHaveAttribute('aria-expanded','true');expect(await cards.locator(':scope > .card:visible').count()).toBeGreaterThan(4);expect(await cards.locator('.value').allTextContents()).toEqual(before);await extra.click();
 }
 await page.locator('#toysThemeToggle').click();
 for(const width of [1440,1024,768,390,360]){
  await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(await page.locator('#controls button:visible,.controls button:visible').evaluateAll(nodes=>nodes.every(e=>e.scrollWidth<=e.clientWidth+1))).toBe(true);
  if(width<=760){await expect(page.locator('#clientSectionSelect')).toBeVisible();await expect(page.locator('#uxNav')).toBeHidden();const top=await cards.evaluate(e=>e.hidden||e.classList.contains('hidden')?0:e.getBoundingClientRect().top);expect(top).toBeLessThan(560);}
 }
 await page.screenshot({path:'/tmp/compact-'+slug+'-mobile-light.png',fullPage:true});
 await page.locator('#clientSectionSelect').selectOption('weekly');await expect(page.locator('#controls,.controls').first()).toBeHidden();await expect(page.locator('#clientSectionSelect')).toHaveValue('weekly');
 await page.locator('#clientSectionSelect').selectOption('campaigns');await expect(page.locator('.campaign-entity')).toHaveCount(1);await expect(page.locator('.campaign-cell[data-metric=impressions]')).toBeHidden();const count=campaignReads;
 await page.getByRole('button',{name:'Все показатели',exact:true}).click();await expect(page.locator('.campaign-cell[data-metric=impressions]')).toBeVisible();await page.getByRole('button',{name:'Основные показатели',exact:true}).click();expect(campaignReads).toBe(count);
 await page.setViewportSize({width:1440,height:1000});await page.locator('#uxNav [data-ux-view=overview]').click();await page.screenshot({path:'/tmp/compact-'+slug+'-desktop-light.png',fullPage:true});if(slug.startsWith('karl')){data.dashboard.ecommerce.account.rows[0].date='2025-01-01';await page.evaluate(()=>{sessionStorage.clear();return caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))));});await page.reload();await expect(page.locator('body')).toHaveAttribute('data-platform-ready','true');await expect(page.locator('#ecomTopCards .client-commerce-result')).toHaveCount(0);await expect(page.locator('#clientExtraMetrics')).toBeHidden();await expect(page.locator('#ecomTopCards .card').first()).toBeVisible();}expect(errors).toEqual([]);
});
