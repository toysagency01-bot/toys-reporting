import {test,expect} from '@playwright/test';
import {selectNovaSection} from './nova-browser-helpers.mjs';

async function fixture(page){
 await page.clock.setFixedTime(new Date('2026-10-14T06:07:00Z'));
 let reads=0;
 const rows=[],key=n=>n.toString(16).padStart(64,'0');
 const add=(id,parent,level,name,count,status='ACTIVE')=>rows.push({key:key(id),parentKey:parent?key(parent):'',level,name,childCount:count,status,provider:'meta_ads',currency:'USD',history:false,metrics:{impressions:3797,clicks:212,ctr:5.58,spend:36.28,conversions:4,cpa:9.07}});
 for(let c=0;c<8;c++){
  const id=c*100+1;add(id,0,'campaign',c===0?'performance diagnostics / гайд / UA / 20.10.26':c===1?'TOYS | Автосервисы | 4 видео | 22.10.2026 [toys_auto_4videos_20261022]':'Кампания '+(c+1),2,c===1?'PAUSED':'ACTIVE');
  for(let g=0;g<2;g++){const group=id+g*10+1;add(group,id,'group',g?'Ретаргетинг / посетители сайта':'Европа / США / Украина',4);for(let a=0;a<4;a++)add(group+a+1,group,'ad',a?'New Leads Ad — вариант '+(a+1):'New Leads Ad',0);}
 }
 await page.route('**/campaign-browser?*',route=>{reads++;return route.fulfill({json:{ok:true,rows:rows.filter(r=>!r.parentKey),total:8,nextOffset:null,sources:[],dataset:{rows,complete:true,completeParents:['',...rows.filter(r=>r.level!=='ad').map(r=>r.key)]}}});});
 await page.route('**/campaign-control',route=>route.fulfill({json:{ok:true,canManage:true,providers:['meta_ads']}}));
 await page.goto('/api/v2/projects/housevip-cxp7/content-project');
 return {reads:()=>reads,key};
}
for(const theme of ['dark','light'])test(`dense campaign hierarchy stays distinct and aligned in ${theme}`,async({page})=>{
 await page.setViewportSize({width:1440,height:1000});const f=await fixture(page);if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#toysThemeToggle').click();await page.locator('[data-ux-view=campaigns]').click();
 const campaign=page.locator(`[data-node="${f.key(1)}"]`),group=page.locator(`[data-node="${f.key(2)}"]`);
 await campaign.locator('> .campaign-row .campaign-node-open').click();await group.locator('> .campaign-row .campaign-node-open').click();
 await expect(page.locator('.campaign-entity')).toHaveCount(14);
 const geometry=await page.locator('.campaign-row').evaluateAll(rows=>rows.slice(0,6).map(r=>({height:r.getBoundingClientRect().height,x:r.querySelector('.campaign-cell').getBoundingClientRect().x,bg:getComputedStyle(r).backgroundColor,border:getComputedStyle(r.querySelector('.campaign-cell')).borderWidth})));
 expect(new Set(geometry.map(r=>Math.round(r.x))).size).toBe(1);expect(new Set(geometry.map(r=>r.bg)).size).toBeGreaterThan(2);expect(geometry.every(r=>r.border==='0px'&&r.height<125)).toBe(true);
 await expect(campaign.locator('> .campaign-row .campaign-child-count')).toHaveText('Групп: 2');await expect(group.locator('> .campaign-row .campaign-child-count')).toHaveText('Объявлений: 4');
 await page.screenshot({path:`dist/campaign-ux-${theme}.png`});
 await page.evaluate(()=>scrollTo(0,450));const context=await campaign.locator('> .campaign-row').boundingBox();expect(context.y).toBeGreaterThanOrEqual(37);const groupContext=await group.locator('> .campaign-row').boundingBox();expect(groupContext.y).toBeGreaterThanOrEqual(context.y+context.height-1);await page.screenshot({path:`dist/campaign-ux-${theme}-scroll.png`});
 await page.getByRole('button',{name:'Свернуть всё',exact:true}).click();await expect(page.locator('.campaign-entity')).toHaveCount(8);expect(f.reads()).toBe(1);await expect(page.locator('.campaign-search input')).toBeFocused();
});
test('mobile keeps parent context, readable metrics and touch controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});const f=await fixture(page);await selectNovaSection(page,'campaigns');
 await page.locator(`[data-node="${f.key(1)}"] .campaign-node-open`).click();await expect(page.locator('.campaign-parent-summary')).toContainText('performance diagnostics');
 await page.locator(`[data-node="${f.key(2)}"] .campaign-node-open`).click();await expect(page.locator('.campaign-parent-summary')).toContainText('Европа / США / Украина');await expect(page.locator('.campaign-entity')).toHaveCount(4);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'dist/campaign-ux-mobile.png'});
 await page.getByRole('button',{name:'Свернуть всё',exact:true}).click();await expect(page.locator('.campaign-entity')).toHaveCount(8);expect(f.reads()).toBe(1);
});
