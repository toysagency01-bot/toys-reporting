import {test,expect} from '@playwright/test';
for(const slug of ['housevip-cxp7','bs-clinic-a5b4','profkit-instashop-r4vk','karlovarska-sul-k4rm'])test(slug+' preserves the original metric structure and theme with compact cards',async({page,request})=>{
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
 await page.getByRole('button',{name:'Максимум',exact:true}).click();await expect(page.locator('#uxInsightTitle')).toBeVisible();
 const cards=page.locator(slug.includes('instashop')?'#cards':'#mainCards');
 await expect(page.locator('#clientExtraMetrics,.client-commerce-result,.campaign-metrics-toggle')).toHaveCount(0);
 const labels=await cards.locator(':scope > .card:visible .label').allTextContents();
 if(slug.startsWith('karl')){
  for(const channel of await page.locator('#ecomTopCards>.ecom-channel').all()){
   await expect(channel.locator('.cards>.card:visible .label')).toHaveText(['Расход','Показы','Клики','CTR']);
  }
 }else if(slug.includes('instashop')){
  expect(labels.map(l=>l.trim())).toEqual(['Расход','Показы','Клики','CTR','Direct-обращения','Квал. обращения','Продажи','Выручка','ROAS','Цена квала','Цена продажи']);
 }else{
  expect(await cards.locator(':scope > .card:visible .value').evaluateAll(nodes=>nodes.map(n=>n.id))).toEqual(['kSpend','kImpr','kClicks','kCtr','kConv','kCpa']);
 }
 const metricCards=slug.startsWith('karl')?page.locator('#ecomTopCards .card'):cards.locator(':scope > .card:visible');
 expect(await metricCards.first().evaluate(e=>e.getBoundingClientRect().height)).toBeLessThan(115);
 if(!slug.includes('instashop'))await expect(page.locator('#uxOverview .ux-period-panel')).toBeVisible();
 await page.locator('#toysThemeToggle').click();
 // The compact layer must not change any of the original light-theme colours.
 const palette=await page.evaluate(()=>{
  const selectors=['#uxNav .active','#periodSeg .active','#toysThemeToggle','#uxWeeklyAdd','#platformCRMStats .card','#uxOverview .ux-insight',document.getElementById('cards')?'#cards .card':'#mainCards .card'];
  const read=()=>selectors.map(selector=>{const e=document.querySelector(selector),c=e&&getComputedStyle(e);return c&&[c.color,c.backgroundColor,c.borderColor,c.backgroundImage];});
  const compact=read();document.body.classList.remove('client-compact');const original=read();document.body.classList.add('client-compact');return {compact,original};
 });expect(palette.compact).toEqual(palette.original);
 for(const width of [1440,1024,768,390,360]){
  await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(await page.locator('#controls button:visible,.controls button:visible').evaluateAll(nodes=>nodes.every(e=>e.scrollWidth<=e.clientWidth+1))).toBe(true);
  if(width<=760){await expect(page.locator('#clientSectionSelect')).toBeVisible();await expect(page.locator('#uxNav')).toBeHidden();expect(await metricCards.evaluateAll(nodes=>nodes.every(e=>{const r=e.getBoundingClientRect();return [...e.querySelectorAll('.label,.value')].every(n=>{const b=n.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right+1;});}))).toBe(true);}
 }
 await page.screenshot({path:'/tmp/restored-'+slug+'-mobile-light.png',fullPage:true});
 await page.locator('#clientSectionSelect').selectOption('weekly');await expect(page.locator('#controls,.controls').first()).toBeHidden();await expect(page.locator('#clientSectionSelect')).toHaveValue('weekly');
 await page.locator('#clientSectionSelect').selectOption('campaigns');await expect(page.locator('.campaign-entity')).toHaveCount(1);const count=campaignReads;
 const cells=page.locator('.campaign-row .campaign-cell');await expect(cells).toHaveCount(slug.startsWith('karl')?8:6);for(const cell of await cells.all())await expect(cell).toBeVisible();expect(campaignReads).toBe(count);
 await page.setViewportSize({width:1440,height:1000});await page.locator('#uxNav [data-ux-view=overview]').click();await page.screenshot({path:'/tmp/restored-'+slug+'-desktop-light.png',fullPage:true});expect(errors).toEqual([]);
});
