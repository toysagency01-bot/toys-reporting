export async function projectFixture({page,request,slug}){
 const data=await(await request.get('/api/v2/projects/housevip-cxp7/dashboard')).json();data.dashboard.project.slug=slug;
 const m=(metricCode,value,currency=null)=>({metricCode,value:String(value),state:'observed',currency}),row=data.dashboard.facts.rows[0];
 if(slug.includes('instashop'))data.dashboard.instashop={ads:{rows:[{...row,metrics:[m('ads.spend_uah',410,'UAH'),m('ads.impressions',1000),m('ads.clicks',25),m('instashop.meta_direct',4)]}]},sales:{rows:[{date:row.date,metrics:[m('instashop.sales_count',2),m('instashop.revenue_uah',1000,'UAH'),m('instashop.direct_inquiries',10),m('instashop.qualified_inquiries',8),m('instashop.unqualified_inquiries',2)]}]}};
 if(slug.startsWith('karl')){data.dashboard.advertising={channels:{meta:data.dashboard.facts,google:data.dashboard.facts}};const rows=[{date:row.date,platform:'Meta Ads',metrics:[m('ecom.purchases',2),m('ecom.purchase_value',200,'EUR'),m('ecom.add_to_cart',5),m('ecom.checkout',3)]}];data.dashboard.ecommerce={account:{rows},campaigns:{rows:rows.map(r=>({...r,campaign:{label:'Synthetic campaign'}}))}};}
 await page.route('**/projects/'+slug+'/dashboard*',r=>r.fulfill({json:data}));
 await page.route('**/projects/'+slug+'/content/tabs*',r=>r.fulfill({json:{ok:true,tabs:[]}}));
 await page.route('**/projects/'+slug+'/crm/summary?*',r=>r.fulfill({json:{ok:true,available:true,qualified:3,sales:1,revenue:[{value:1000,currency:'EUR'}]}}));
 await page.route('**/projects/'+slug+'/weekly-reports',r=>r.fulfill({json:{ok:true,reports:[]}}));
 let campaignReads=0;await page.route('**/campaign-browser?*',r=>{campaignReads++;return r.fulfill({json:{ok:true,rows:[{key:'1'.padStart(64,'0'),name:'Synthetic campaign',provider:'meta_ads',currency:'EUR',level:'campaign',status:'ACTIVE',history:false,metrics:{spend:100,conversions:5,cpa:20,impressions:1000,clicks:25,ctr:2.5,purchases:2,roas:3}}],total:1,nextOffset:null,sources:[]}});});
 return {data,campaignReads:()=>campaignReads};
}

export const sourceMetrics=page=>page.evaluate(()=>[...document.querySelectorAll('#clientMetricGroups>.client-metric-group')].flatMap(p=>p.getAttribute('aria-owns').split(' ').filter(Boolean).map(id=>{const card=document.getElementById(id);if(!card)return [p.dataset.metricGroup,'missing',id];const value=card.querySelector('.value').cloneNode(true);value.querySelectorAll('.delta').forEach(n=>n.remove());return [p.dataset.metricGroup,card.querySelector('.label').textContent.trim(),value.textContent.replace(/\s+/g,' ').trim()];})).sort());
export const displayMetrics=page=>page.evaluate(()=>[...document.querySelectorAll('#novaMetricGroups .nova-metric')].map(card=>{const value=card.querySelector('.nova-metric-value');return [card.closest('[data-nova-group]').dataset.novaGroup,card.querySelector('.nova-metric-label').textContent.trim(),(value.dataset.fullValue||value.textContent).replace(/\s+/g,' ').trim()];}).sort());
