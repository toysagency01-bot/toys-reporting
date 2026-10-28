import {mountMonthlyReports} from '../monthly/ui.js';
import {currencySymbol} from '../unified/currency.js';
import {advertisingBasis,qualificationBasis} from './ads-revision.js';
import {keyCRMCoverage} from './keycrm-coverage.js';
import {qualificationCost} from './qualification-cost.js';
import {mountClientBack} from './mobile-back.js';
import {mountClientUX} from './client-ux.js';
import {mountNovaDesign} from './nova-design.js';
import {holdNovaLoading} from './nova-loading.js';
import projectRegistry from '../projects.json' with {type:'json'};
import {mountCalendar} from './calendar.js';
import {nextRefreshAt} from '../imports/refresh-policy.js';
import {memoryCache} from '../master/cache.js';
import {responseCache,clearDashboardStorage} from './response-cache.js';
import {mountClientNavigation,isClientCRMRoute} from './client-navigation.js';
import clientShellStyle from './client-shell.css';
import {mountMobileKeyboard} from './mobile-navigation.js';
import {mountSalesDemoFunnel} from './sales-demo-funnel.js';
import {mountCampaignBrowser} from './campaign-browser.js';
import {scheduleRender,updateChart,observeScrollFades} from './rendering.js';
import {renderTopCreatives} from './top-creatives.js';
import {sourceTable,weeklyTable} from './data.js';
import {syncInstashopCoverage} from './instashop-coverage.js';
import {tools} from '../dist/native-tools.mjs';
import {advertisingModel,snapshotRows,aggregate,escapeHtml as h,validRange,valueOf} from '../unified/model.js';
const slug=window.TOYS_UNIFIED_PROJECT;
const finishNovaLoading=holdNovaLoading(slug);
const entryHash=location.hash;
const initialCRM=isClientCRMRoute(location.pathname,entryHash);
const prefix='';
const api=`${prefix}/api/v2/projects/${slug}`;
// Use the same authenticated, forwarded route as the document. The Pages
// gateway does not necessarily forward arbitrary /api/ui/* asset paths.
const assetBase=window.TOYS_UI_ASSET_BASE?new URL(window.TOYS_UI_ASSET_BASE,location.href).href:null;
const asset=path=>assetBase?`${assetBase}${encodeURIComponent(path)}`:`${api}/content-project?ui=${encodeURIComponent(path)}`;
const privateMode=window.TOYS_MVP_PROJECT_PORTAL===true;
const dataCache=responseCache({prefix:api+'/'});
const materialCache=memoryCache({ttl:20*60*1000,maxEntries:30});
const shop=slug==='profkit-instashop-r4vk';
// Retire only the old, truncated Instashop snapshot cache after this schema fix.
const materialRevision=projectRegistry[slug]?.contentRevision?encodeURIComponent(projectRegistry[slug].contentRevision):'';
const demoTabsAddress=api+'/content/tabs'+(projectRegistry[slug]?.synthetic?'?demo=v2':materialRevision?'?materials='+materialRevision:'');
const dashboardAddress=api+'/dashboard'+(shop?'?coverage=streams-v2':'');
const projectConfig=projectRegistry[slug];
const title=projectConfig.title;
const projectDay=new Intl.DateTimeFormat('en-CA',{timeZone:projectConfig.periodTimezone||'Asia/Tbilisi',year:'numeric',month:'2-digit',day:'2-digit'});
const $=id=>document.getElementById(id);
let creativeRankings=null,creativeState="loading",creativeSequence=0;
let crmStats=null,clientNavigation,campaignBrowser,salesFunnel,clientUX;
let dashboard,allRows=[],ads=null,snapshotPromise,tabsPromise,ready=false,toolkit,refreshing=false,sequence=0,calendar,refreshTimer,periodTimer;
const readJSON=async(url,options={})=>{const r=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(30000),...options});const d=await r.json().catch(()=>({}));if(!r.ok||!(d.ok||d.status==='ok')){const status=r.redirected?401:r.status;if([401,403].includes(status))clearDashboardStorage();throw Object.assign(new Error(d.error||`HTTP ${status}`),{status});}return d;};
const json=(url,options={})=>dataCache.get(url,()=>readJSON(url,options));
const salesContext=()=>({range:range(),provider:document.querySelector('#platformSeg .active')?.dataset.platform==='Google Ads'?'google_ads':document.querySelector('#platformSeg .active')?.dataset.platform==='Meta Ads'?'meta_ads':''});
const range=()=>({from:$(shop?'from':'dateFrom')?.value||'',to:$(shop?'to':'dateTo')?.value||''});
function notice(text,error=false){const n=$('platformNotice');if(n){n.textContent=text;n.hidden=!text;n.dataset.error=String(error);}}
const load=path=>new Promise((resolve,reject)=>{if(window.TOYS_BUNDLED_SCRIPTS?.[path]){try{window.TOYS_BUNDLED_SCRIPTS[path]();resolve();}catch(e){reject(e);}return;}const s=document.createElement('script');s.src=asset(path);s.onload=resolve;s.onerror=()=>reject(new Error('Не удалось загрузить '+path));document.head.append(s);});
const css=path=>new Promise((resolve,reject)=>{if(window.TOYS_BUNDLED_STYLES?.[path]){const style=document.createElement('style');style.textContent=window.TOYS_BUNDLED_STYLES[path];document.head.append(style);resolve();return;}const l=document.createElement('link');l.rel='stylesheet';l.href=asset(path);l.onload=resolve;l.onerror=()=>reject(new Error('Не удалось загрузить '+path));document.head.append(l);});
const metric=r=>r.metrics||[];
window.TOYS_PLATFORM={today:()=>projectDay.format(new Date()),currencySymbol,invalidate(){dataCache.delete(demoTabsAddress);tabsPromise=json(demoTabsAddress).then(d=>(d.tabs||[]).filter(t=>slug!=='bs-clinic-a5b4'||t.sourceTitle!=='BSCLINIC - Месячная сводка'));materialCache.clear();},asset,scheduleRender,updateChart,observeScrollFades,async fx(from,to){const d=await json(`${api}/exchange-rate?base=${from}&quote=${to}`);return Response.json({date:d.rate.date,[from.toLowerCase()]:{[to.toLowerCase()]:Number(d.rate.rate)}});},tabs:()=>tabsPromise,afterRender(){if(ready){attachHierarchy();maskUnavailable();calendar?.sync();renderCRM();renderCreatives();salesFunnel?.sync();clientUX?.sync();}},async table(name,raw){
 if(name==='WeeklyComments')return weeklyTable((await json(api+'/weekly-reports')).reports||[]);
 if(['GoogleAds','MetaAds','InstashopSales','EcomFunnel','EcomFunnelCampaign','Insights','MetaAdsFormat','QualifiedLeads'].includes(name))return sourceTable(await snapshotPromise,name);
 const path=`${api}/content/tabs?tab=${encodeURIComponent(name)}${raw&&!projectConfig.preparedMaterials?'&raw=1':''}${materialRevision?'&materials='+materialRevision:''}`;return materialCache.get(path,()=>json(path));
}};
const numberFormat=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const format=n=>n==null?'—':numberFormat.format(n);
function selectedRows(){const r=range();return allRows.filter(row=>row.date>=r.from&&row.date<=r.to);}
function maskUnavailable(){
 if(shop)syncInstashopCoverage({dashboard,rows:allRows,ads,range:range()});
 if(!shop&&ads){const latest=allRows.map(r=>r.date).filter(Boolean).sort().at(-1);if(latest&&$('updated'))$('updated').textContent='данные по '+latest;}
 const rows=selectedRows();if(!rows.length)return;const t=aggregate(rows);
 const missing={kImpr:t.impressions,kClicks:t.clicks,kConv:t.conversions,kCpa:t.conversions,kCtr:t.impressions};
 for(const[id,v]of Object.entries(missing)){if(v===null&&$(id))$(id).textContent='—';}
 // Do not turn unknown conversions into a plotted zero in the original renderer.
 const chart=window.Chart?.getChart?.($('chart'));
 if(chart&&t.conversions===null){let changed=false;for(const d of chart.data.datasets){if(/лид|конвер|cpa|цена/i.test(d.label||'')&&d.data.some(v=>v!==null)){d.data=d.data.map(()=>null);changed=true;}}if(changed)chart.update('none');}
 // The original renderer assumes one matching currency per commerce channel.
 // Preserve its layout, but never divide revenue by spend in another currency.
 const period=range();const commerce=(dashboard.ecommerce?.account?.rows||[]).filter(r=>r.date>=period.from&&r.date<=period.to);
 const unsafe=commerce.some(r=>{const m=metric(r).find(m=>m.metricCode==='ecom.purchase_value');const provider=r.platform==='Google Ads'?'google_ads':r.platform==='Meta Ads'?'meta_ads':null;const costs=rows.filter(a=>a.provider===provider);return !provider||valueOf(m)===null||!m.currency||!costs.length||costs.some(a=>a.currency!==m.currency||a.spend===null);});
 if(unsafe){
  for(const label of document.querySelectorAll('#ecomFunnelCards .label,#channelBreakdown .chan-ecom-metric > span,#campList .mlabel')){if(label.textContent.trim()==='ROAS'){const value=label.parentElement.querySelector('.value,b,.mval');if(value)value.textContent='—';}}
  for(const price of document.querySelectorAll('#ecomFunnelCards .value small')){if(price.textContent.includes('цена:'))price.textContent='цена неизвестна';}
  if(chart){let changed=false;for(const d of chart.data.datasets){if(/roas/i.test(d.label||'')&&d.data.some(v=>v!==null)){d.data=d.data.map(()=>null);changed=true;}}if(changed)chart.update('none');}
 }
}
function attachHierarchy(){campaignBrowser?.sync();}
function shopLiveRows(rows){
 // Native Instashop accounting is UAH. Use only the source's explicit daily FX.
 const facts=dashboard.instashop?.ads?.rows||[],ratiosByDay=new Map();for(const f of facts){const u=metric(f).find(m=>m.metricCode==='ads.spend_uah'),d=metric(f).find(m=>m.metricCode==='ads.raw_spend_usd');if(valueOf(d)>0&&valueOf(u)!=null){if(!ratiosByDay.has(f.date))ratiosByDay.set(f.date,[]);ratiosByDay.get(f.date).push(valueOf(u)/valueOf(d));}}
 for(const r of ads?.exchangeRates||[])if(Number(r.rate)>0)ratiosByDay.set(r.date,[Number(r.rate)]);
 return rows.map(r=>{let spend=r.spend,usd=null;if(r.currency==='USD'){const ratios=ratiosByDay.get(r.date)||[];if(!ratios.length||Math.max(...ratios)-Math.min(...ratios)>0.01)return null;usd=spend;spend=spend==null?null:spend*ratios[0];}else if(r.currency!=='UAH')return null;
 return {date:r.date,platform:'Meta Ads',account:title,accountId:r.integrationId||'',currency:'UAH',campaign:r.name,impressions:r.impressions,clicks:r.clicks,spendUah:spend,metaDirect:r.conversions,spendUsd:usd,fx:usd>0?spend/usd:null};});
}
let appliedAds='';
function applyAds(rows,commerce=null){const signature=JSON.stringify([rows,commerce,ads?.providers.map(p=>p.hierarchy)]);if(signature===appliedAds)return;appliedAds=signature;window.TOYS_NATIVE.refreshAds(rows,commerce);}
async function refresh(){
 if(refreshing)return;const requested=range();if(!validRange(requested.from,requested.to)||(Date.parse(requested.to)-Date.parse(requested.from))/86400000>=366){notice('Для обновления кабинета выберите период не длиннее года.',true);return;}
 refreshing=true;const seq=++sequence,address=`${api}/${privateMode?'content-project/ads/hierarchy':'ads-summary'}?from=${requested.from}&to=${requested.to}&crmBasis=${qualificationBasis(slug)}&adsBasis=${advertisingBasis(slug)}`;
 const apply=(result,cached=false)=>{if(seq!==sequence||JSON.stringify(range())!==JSON.stringify(requested))return;ads=result;if(!privateMode)crmStats=result.crm||null;renderCRM();
  const names=[...new Set((ads.providers||[]).map(p=>p.provider))].filter(name=>ads.providers.filter(p=>p.provider===name).every(p=>p.hierarchy&&p.requestedRange?.from===requested.from&&p.requestedRange?.to===requested.to));
  const normalized=advertisingModel(dashboard,ads,requested);const live=allRows.filter(r=>r.date>=requested.from&&r.date<=requested.to&&!names.includes(r.provider)).concat(normalized.filter(r=>names.includes(r.provider)));const base=allRows.filter(r=>r.date<requested.from||r.date>requested.to);const all=[...base,...live];
  let commerce=null;if(dashboard.ecommerce&&result.commerce?.completeProviders?.length){const updated=new Set(result.commerce.completeProviders.map(p=>p==='meta_ads'?'Meta Ads':'Google Ads'));for(const [key,rows]of [['account',result.commerce.account],['campaigns',result.commerce.campaigns]]){const previous=dashboard.ecommerce[key]||{};dashboard.ecommerce[key]={...previous,rows:[...(previous.rows||[]).filter(r=>!updated.has(r.platform)||r.date<requested.from||r.date>requested.to||(result.commerce.coverageByProvider?.[r.platform==='Meta Ads'?'meta_ads':'google_ads']&&!result.commerce.coverageByProvider[r.platform==='Meta Ads'?'meta_ads':'google_ads'].includes(r.date))),...rows]};}commerce={account:sourceTable(dashboard,'EcomFunnel'),campaigns:sourceTable(dashboard,'EcomFunnelCampaign')};}
  if(names.length||commerce){if(shop){const mapped=shopLiveRows(all);if(mapped.some(r=>r===null)){notice('Детализация получена. Для сводки в гривнах не хватает подтверждённого курса; сохранены опубликованные показатели.',true);attachHierarchy();return;}allRows=all;applyAds(mapped);}
  else {allRows=all;applyAds(all.map(r=>({date:r.date,platform:r.provider==='google_ads'?'Google Ads':'Meta Ads',account:title,accountId:r.integrationId||'',currency:r.currency,campaign:r.name,campaignId:r.campaignId,impr:r.impressions,clicks:r.clicks,cost:r.spend,conv:r.conversions})),commerce);}}
  if(result.refreshing){notice('Показаны сохранённые данные. Импорт по расписанию ещё выполняется.');}
  else{notice(result.providers?.map(p=>`${p.provider==='google_ads'?'Google Ads':'Meta Ads'}: ${p.hierarchy?(p.freshness==='fresh'?'обновлено':p.freshness==='partial'?'история + данные API':'сохранённые данные')+(p.fetchedAt?' — '+new Date(p.fetchedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):''):'подключение не завершено'}`).join('; ')||'');}maskUnavailable();
 };
 try{const saved=await dataCache.load(address);if(saved){apply(saved.value,true);if(saved.fresh)return;notice('Показаны сохранённые данные. Обновляем в фоне…');}else notice('Обновляем данные…');apply(await json(address));}
 catch(e){notice('Не удалось обновить кабинет. Последние данные сохранены. Повторим по расписанию.',true);}finally{refreshing=false;renderCreatives();if(JSON.stringify(range())!==JSON.stringify(requested))queueRefresh();}
}

async function refreshCRM(){
 if(projectConfig.synthetic)return salesFunnel?.sync(true);
 if(window.TOYS_CRM_ALLOWED===false)return;
 if(!privateMode)return;const requested=range();
 try{const d=await readJSON(`${api}/crm/summary?from=${requested.from}&to=${requested.to}`);if(JSON.stringify(range())===JSON.stringify(requested)){crmStats=d;renderCRM();}}catch{}
}
function renderCRM(){
 let panel=$('platformCRMStats');if(!panel){const host=$('mainCards')||$('cards')||document.querySelector('#uxOverview .cards');if(!host)return;panel=document.createElement('div');panel.id='platformCRMStats';panel.className='cards';host.after(panel);}
 panel.hidden=!crmStats?.available&&crmStats?.source!=='keycrm';if(panel.hidden){clientUX?.sync();return;}
 const demoRows=projectConfig.synthetic?selectedRows().filter(r=>!salesContext().provider||r.provider===salesContext().provider):null;
 const cost=crmStats.source==='keycrm'?qualificationCost(advertisingModel(dashboard,ads,range()),crmStats):null;
 const signature=JSON.stringify([crmStats,demoRows,cost]);if(panel._renderSignature!==signature){panel._renderSignature=signature;const cards=[['Квал-лиды CRM',format(crmStats.qualified)],...(crmStats.source==='keycrm'?[['Стоимость квала',cost?format(cost.value)+' '+h(currencySymbol(cost.currency)):'—','Расход на рекламу ÷ квал-лиды CRM за выбранный период · utm_source=toys']]:[]),...(crmStats.qualificationOnly?[]:[['Продажи CRM',format(crmStats.sales)],['Выручка CRM',(crmStats.revenue||[]).map(r=>format(r.value)+' '+h(currencySymbol(r.currency))).join('<br>')||'—']])];if(projectConfig.synthetic){const rows=demoRows,cost=aggregate(rows).money.find(m=>m.currency==='EUR')?.spend,revenue=(crmStats.revenue||[]).find(m=>m.currency==='EUR')?.value;cards.push(['Стоимость квала',cost!=null&&crmStats.qualified>0?format(cost/crmStats.qualified)+' '+currencySymbol('EUR'):'—'],['Стоимость продажи',cost!=null&&crmStats.sales>0?format(cost/crmStats.sales)+' '+currencySymbol('EUR'):'—'],['ROAS CRM',cost>0&&revenue!=null?format(revenue/cost)+'×':'—']);}panel.innerHTML=cards.map(([label,value,hint])=>`<div class="card"><div class="label">${label}</div><div class="value">${value}</div>${hint||crmStats.source==='keycrm'?`<div class="note">${h(hint||keyCRMCoverage(crmStats))}</div>`:''}</div>`).join('');}
 clientUX?.sync();
}
function renderCreatives(){if(!ready)return;const channels=Object.keys(dashboard.advertising?.channels||{}).map(c=>/google/i.test(c)?'google_ads':'meta_ads');renderTopCreatives({rankings:creativeRankings,state:creativeState,activeChannel:document.querySelector('#platformSeg .active')?.dataset.platform||'__all',range:range(),channels:channels.length?[...new Set(channels)]:['meta_ads'],slug});}
async function refreshCreatives(){
 const requested=range(),seq=++creativeSequence;if(!creativeRankings)creativeState='loading';renderCreatives();
 const address=`${api}/top-creatives?from=${requested.from}&to=${requested.to}&crmBasis=${qualificationBasis(slug)}&adsBasis=${advertisingBasis(slug)}`,apply=(data,cached=false)=>{if(seq!==creativeSequence||JSON.stringify(range())!==JSON.stringify(requested))return;creativeRankings=data.rankings;creativeState='ready';renderCreatives();};
 try{const saved=await dataCache.load(address);if(saved){apply(saved.value,true);if(saved.fresh)return;creativeState='refreshing';renderCreatives();}apply(await json(address));}
 catch{if(seq!==creativeSequence)return;creativeState='error';}
 finally{if(seq===creativeSequence)renderCreatives();}
}
function queueRefresh(){crmStats=null;renderCRM();creativeSequence++;creativeRankings=null;creativeState='loading';clearTimeout(periodTimer);periodTimer=setTimeout(()=>{renderCreatives();refreshCreatives();refresh();refreshCRM();},300);}
let lastAutoRefresh=Date.now(),autoRunning=false;
async function autoRefresh(force=false){
 if(autoRunning||document.hidden||!force&&Date.now()<nextRefreshAt(lastAutoRefresh)+60000)return;autoRunning=true;lastAutoRefresh=Date.now();materialCache.clear();
 try{const d=await json(dashboardAddress);const changed=JSON.stringify(d.dashboard)!==JSON.stringify(dashboard);dashboard=d.dashboard;snapshotPromise=Promise.resolve(dashboard);if(changed){appliedAds='';allRows=snapshotRows(dashboard);const names=['MetaAds','GoogleAds','InstashopSales','EcomFunnel','EcomFunnelCampaign'];window.TOYS_NATIVE.refreshSnapshot(Object.fromEntries(names.map(n=>[n,sourceTable(dashboard,n)])));}await Promise.all([refresh(),refreshCreatives(),refreshCRM()]);campaignBrowser?.refresh();}catch(e){notice('Автообновление временно недоступно. Сохранены последние данные.',true);}finally{autoRunning=false;}
}

function mountTools(){
 if(projectConfig.synthetic&&!$('salesDemoNotice')){const demo=document.createElement('p');demo.id='salesDemoNotice';demo.className='platform-notice';demo.textContent='ДЕМО. Все компании, контакты и показатели вымышлены. Сценарий для демонстрации платформы, не реальный кейс.';document.querySelector('body > header')?.after(demo);}
 if(!$('platformClientNav')){const nav=document.createElement('aside');nav.id='platformClientNav';nav.setAttribute('aria-label','Разделы кабинета');nav.innerHTML=`<a id="platformHomeNav" class="active" aria-current="page" href="${prefix}/${encodeURIComponent(slug)}/"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg><span>Главная</span></a><a id="platformCRMNav" href="${api}/content-crm"><svg viewBox="0 0 24 24"><path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z"/></svg><span>CRM</span></a>`;const account=document.createElement('a');account.id='platformAccountNav';account.href=privateMode?prefix+'/api/v2/portal/session?choose=1':'/login';account.textContent=privateMode?'Аккаунт':'Войти';nav.append(account);document.body.append(nav);document.body.classList.add('platform-client-shell');const style=document.createElement('style');style.textContent=clientShellStyle;document.head.append(style);const mobileAccount=account.cloneNode(false);mobileAccount.id='platformMobileAccount';mobileAccount.setAttribute('aria-label',privateMode?'Мой аккаунт':'Войти в TOYS');mobileAccount.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg>';document.querySelector('body > header')?.append(mobileAccount);mountMobileKeyboard();}


 if(window.TOYS_CRM_ALLOWED===false){$('platformCRMNav')?.remove();document.querySelectorAll('[data-ux-view="leads"]').forEach(n=>n.remove());}
 // Replace only the old editing workflow; the native navigation/panels stay in place.
 $('weeklyModal')?.remove();
 const weeklyHost=$('weeklyPanel')||$('weekly')?.closest('.panel');
 if(weeklyHost){weeklyHost.classList.remove('hidden');weeklyHost.classList.add('toys-tools');weeklyHost.querySelectorAll(':scope > *').forEach(n=>n.hidden=true);weeklyHost.insertAdjacentHTML('beforeend','<div id="weeklyContent"></div><div id="weeklyArchive"></div>');}
 document.body.insertAdjacentHTML('beforeend','<dialog id="history" class="toys-tools"><div class="panel-title"><h2>История отчёта</h2><button type="button" data-close>Закрыть</button></div><div id="historyContent"></div></dialog>');
 let project=$('projectView');
 if(!project&&shop){project=document.createElement('section');project.id='uxProject';project.className='ux-section';project.innerHTML='<div class="ux-page-heading"><div><p>РАБОТА ПО ПРОЕКТУ</p><h1>Проект</h1></div></div><div id="uxProjectChannels" class="ux-project-channels"><button type="button" data-legacy-view="meta" class="active">Meta</button></div>';$('content').append(project);const nav=document.createElement('a');nav.href='#project';nav.dataset.uxView='project';nav.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 7.5h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11Z"/><path d="M8 7.5V5.8A2.3 2.3 0 0 1 10.3 3.5h3.4A2.3 2.3 0 0 1 16 5.8v1.7M4 12h16"/></svg><span>Проект</span>';$('uxNav').append(nav);}
 const creative=document.createElement('section');creative.className='toys-tools panel';creative.id='platformCreatives';creative.hidden=true;creative.innerHTML='<h2>Креативы Meta</h2><div id="creativeContent"></div>';project?.append(creative);
 const channels=$('uxProjectChannels');
 const syncCreatives=()=>{const selected=channels?.querySelector('.active');const meta=(selected?.dataset.legacyView||selected?.dataset.channel)==='meta';creative.hidden=!meta;if(meta)toolkit.loadCreatives();};
 document.addEventListener('click',e=>{if(e.target.closest('#uxProjectChannels button,[data-ux-view="project"]'))queueMicrotask(syncCreatives);});
 toolkit=tools({api,range,notify:notice,privateMode});syncCreatives();if(shop&&['#meta','#project'].includes(entryHash)){$('uxNav')?.querySelector('[data-ux-view="project"]')?.click();syncCreatives();}
 if(!privateMode||window.TOYS_ACCESS_ROLE==='viewer'){document.querySelectorAll('#uxWeeklyAdd,#openWeekly').forEach(n=>{n.hidden=true;n.classList.add('hidden');});}
 document.addEventListener('click',async e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;if(e.target.closest('#uxWeeklyAdd,#openWeekly')){e.preventDefault();e.stopImmediatePropagation();$('uxNav')?.querySelector('[data-ux-view="weekly"]')?.click();await toolkit.openWeeklyEditor();}if(e.target.closest('[data-ux-view="weekly"]')){toolkit.loadWeekly();toolkit.loadWeeklyArchive();}},true);
 if(location.hash==='#weekly'||location.pathname.endsWith('/content-editor')){$('uxNav')?.querySelector('[data-ux-view="weekly"]')?.click();toolkit.loadWeekly();toolkit.loadWeeklyArchive();}
}
async function boot(){
 if(initialCRM)history.replaceState(null,'',location.pathname+location.search+'#overview');
 const legacy=new URLSearchParams(location.hash.slice(1));if(legacy.has('section')){const names={overview:'overview',campaigns:'campaigns',funnel:'funnel',weekly:'weekly',materials:'project',project:'project'};const route=legacy.get('view')==='campaigns'?'campaigns':names[legacy.get('section')]||'overview';history.replaceState(null,'',location.pathname+location.search+'#'+route);}

 // Font availability must never prevent the dashboard and data from opening.

 const channels=projectConfig.channels.map(key=>({key,label:{smm:'SMM',meta:'Meta',google:'Google',project:'Проект'}[key]}));
 document.title=`TOYS × ${title} — Дашборд результатов`;const icon=document.createElement('link');icon.rel='icon';icon.type='image/svg+xml';icon.href=window.TOYS_FAVICON||asset('assets/favicon.svg');document.head.append(icon);
 window.DASH_CONFIG={...(slug==='housevip-cxp7'?{spendFx:{from:'IDR',to:'EUR'}}:{}),title,locked:true,showDrafts:false,sheetId:'platform',projectSheetId:'platform',projectApiKey:'platform',projectChannels:channels,weeklyProjectKey:slug,weeklyFormUrl:'#platform-weekly',conversionLabel:projectConfig.conversionLabel||'Конверсии',conversionShortLabel:projectConfig.conversionShortLabel||'Конв.',platformExplicitTabs:projectConfig.explicitTabs===true};
 window.INSTASHOP_CONFIG={title,sheetId:'platform',weeklyFormUrl:'#platform-weekly'};
 const savedSnapshot=await dataCache.load(dashboardAddress);
 if(savedSnapshot)lastAutoRefresh=savedSnapshot.at;
 snapshotPromise=(savedSnapshot?Promise.resolve(savedSnapshot.value):json(dashboardAddress)).then(d=>dashboard=d.dashboard);tabsPromise=json(demoTabsAddress).then(d=>(d.tabs||[]).filter(t=>slug!=='bs-clinic-a5b4'||t.sourceTitle!=='BSCLINIC - Месячная сводка'));

 if(shop){await load('core/instashop-model.js');await load('core/instashop.js');css('core/ux-v2.css');await load('core/ux-v2-instashop.js');}
 else{await load(slug==='housevip-cxp7'?'housevip-cxp7/core.js':'core/core.js');$('weeklyPanel')?.classList.remove('hidden');css(slug==='housevip-cxp7'?'housevip-cxp7/ux-v2.css':'core/ux-v2.css');await load(slug==='housevip-cxp7'?'housevip-cxp7/ux-v2.js':'core/ux-v2.js');}
 await load('core/theme.js');await css('platform-tools.css');
 if(projectConfig.advertisingChannels)for(const button of document.querySelectorAll('#platformSeg [data-platform]')){const channel={'Google Ads':'google','Meta Ads':'meta'}[button.dataset.platform];if(channel&&!projectConfig.advertisingChannels.includes(channel))button.remove();}
 await snapshotPromise;allRows=snapshotRows(dashboard);await tabsPromise;
 await new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{if(['content','emptyState'].some(id=>$(id)&&!$(id).classList.contains('hidden')))resolve();else if(Date.now()-start>15000)reject(new Error('Данные не загрузились'));else setTimeout(poll,50);};poll();});
 const controls=$('controls')||document.querySelector('.controls');
 const n=document.createElement('div');n.id='platformNotice';n.className='platform-notice';n.setAttribute('role','status');controls.after(n);notice(dashboard.coverage?.warning||'');
 ready=true;mountTools();mountMonthlyReports({slug,entryHash});clientUX=mountClientUX();
 mountNovaDesign({slug});
 maskUnavailable();
 if(!allRows.length&&$('updated'))$('updated').textContent='Нет рекламной активности в загруженном периоде';
 clientNavigation=mountClientNavigation({slug,api,prefix,asset,initialCRM,onChange:async()=>{await refreshCRM();await refreshCreatives();if(projectConfig.synthetic)campaignBrowser?.refresh();}});
 mountClientBack();
 const from=$(shop?'from':'dateFrom'),to=$(shop?'to':'dateTo');
 calendar=mountCalendar({from,to,timeZone:projectConfig.periodTimezone,apply:(start,end)=>{document.querySelectorAll('#periodSeg button').forEach(b=>b.classList.remove('active'));sequence++;ads=null;window.TOYS_NATIVE.setPeriod(start,end);queueRefresh();}});
 if(projectConfig.defaultLastDays){const end=calendar.today(),start=new Date(Date.parse(end+'T12:00:00Z')-(projectConfig.defaultLastDays-1)*86400000).toISOString().slice(0,10);from.value=start;to.value=end;window.TOYS_NATIVE.setPeriod(start,end);calendar.sync();}
 if(projectConfig.synthetic&&projectConfig.demoRange){document.querySelectorAll('#periodSeg button').forEach(b=>b.classList.remove('active'));from.value=projectConfig.demoRange.from;to.value=projectConfig.demoRange.to;window.TOYS_NATIVE.setPeriod(from.value,to.value);calendar.sync();}
 const logo=document.querySelector('header img[alt="TOYS"]');const theme=()=>{if(logo)logo.src=asset(document.documentElement.dataset.theme==='light'?'assets/toys-black.svg':'assets/toys-logo.svg');};theme();new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 campaignBrowser=mountCampaignBrowser({slug,context:salesContext});
 if(projectConfig.synthetic)salesFunnel=mountSalesDemoFunnel({context:salesContext,json:({range,provider})=>json(`${api}/sales-analytics?${new URLSearchParams({...range,provider,version:'1'})}`),onData(data){crmStats={available:data.hasData,qualified:data.totals.qualifiedLeads,sales:data.totals.sales,revenue:[{currency:data.currency,value:data.totals.revenue}]};renderCRM();},onUnavailable(){crmStats=null;renderCRM();}});
 delete document.body.dataset.platformLoading;document.body.dataset.platformReady='true';renderCreatives();finishNovaLoading();
 refreshTimer=setInterval(()=>autoRefresh(),60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)autoRefresh();});
 document.addEventListener('change',e=>{if(e.target===from||e.target===to){sequence++;ads=null;queueRefresh();}},true);
 document.addEventListener('click',e=>{if(e.target.closest('[data-days]')){sequence++;ads=null;queueRefresh();}},true);
 await Promise.all([refresh(),refreshCreatives(),refreshCRM()]);
 if(savedSnapshot&&!savedSnapshot.fresh)autoRefresh(true);
}
boot().catch(e=>{delete document.body.dataset.platformLoading;const n=document.createElement('p');n.setAttribute('role','alert');n.textContent='Не удалось загрузить борд: '+e.message;document.body.append(n);finishNovaLoading(n);});
