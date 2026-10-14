import projectRegistry from '../projects.json' with {type:'json'};
import {mountCalendar} from './calendar.js';
import {nextRefreshAt} from '../imports/refresh-policy.js';
import {memoryCache} from '../master/cache.js';
import {mountClientNavigation,isClientCRMRoute} from './client-navigation.js';
import clientShellStyle from './client-shell.css';
import {mountMobileKeyboard} from './mobile-navigation.js';
import {mountCampaignBrowser} from './campaign-browser.js';
import {scheduleRender,updateChart,observeScrollFades} from './rendering.js';
import {renderTopCreatives} from './top-creatives.js';
import {sourceTable,weeklyTable} from './data.js';
import {tools} from '../dist/native-tools.mjs';
import {advertisingModel,snapshotRows,aggregate,escapeHtml as h,validRange,valueOf} from '../unified/model.js';
const slug=window.TOYS_UNIFIED_PROJECT;
const entryHash=location.hash;
const initialCRM=isClientCRMRoute(location.pathname,entryHash);
const prefix='';
const api=`${prefix}/api/v2/projects/${slug}`;
// Use the same authenticated, forwarded route as the document. The Pages
// gateway does not necessarily forward arbitrary /api/ui/* asset paths.
const assetBase=window.TOYS_UI_ASSET_BASE?new URL(window.TOYS_UI_ASSET_BASE,location.href).href:null;
const asset=path=>assetBase?`${assetBase}${encodeURIComponent(path)}`:`${api}/content-project?ui=${encodeURIComponent(path)}`;
const privateMode=window.TOYS_MVP_PROJECT_PORTAL===true;
const materialCache=memoryCache({ttl:20*60*1000,maxEntries:30});
const shop=slug==='profkit-instashop-r4vk';
const projectConfig=projectRegistry[slug];
const title=projectConfig.title;
const $=id=>document.getElementById(id);
let creativeRankings=null,creativeState="loading",creativeSequence=0;
let crmStats=null,clientNavigation,campaignBrowser;
let dashboard,allRows=[],ads=null,snapshotPromise,tabsPromise,ready=false,toolkit,refreshing=false,sequence=0,calendar,refreshTimer,periodTimer;
const retryTimers={},retryCounts={},retryDelays=[1500,3000,5000,8000,12000,20000,30000];
function resetRetries(){for(const key of ['ads','creatives']){clearTimeout(retryTimers[key]);retryCounts[key]=0;}}
function retrySoon(key,requested,run){clearTimeout(retryTimers[key]);const attempt=retryCounts[key]||0;if(attempt>=retryDelays.length)return;retryCounts[key]=attempt+1;retryTimers[key]=setTimeout(()=>{if(!document.hidden&&JSON.stringify(range())===JSON.stringify(requested))run();},retryDelays[attempt]);}
const json=async(url,options={})=>{const r=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(30000),...options});const d=await r.json();if(!r.ok||!(d.ok||d.status==='ok'))throw new Error(d.error||`HTTP ${r.status}`);return d;};
const range=()=>({from:$(shop?'from':'dateFrom')?.value||'',to:$(shop?'to':'dateTo')?.value||''});
function notice(text,error=false){const n=$('platformNotice');if(n){n.textContent=text;n.dataset.error=String(error);}}
const load=path=>new Promise((resolve,reject)=>{if(window.TOYS_BUNDLED_SCRIPTS?.[path]){try{window.TOYS_BUNDLED_SCRIPTS[path]();resolve();}catch(e){reject(e);}return;}const s=document.createElement('script');s.src=asset(path);s.onload=resolve;s.onerror=()=>reject(new Error('Не удалось загрузить '+path));document.head.append(s);});
const css=path=>new Promise((resolve,reject)=>{if(window.TOYS_BUNDLED_STYLES?.[path]){const style=document.createElement('style');style.textContent=window.TOYS_BUNDLED_STYLES[path];document.head.append(style);resolve();return;}const l=document.createElement('link');l.rel='stylesheet';l.href=asset(path);l.onload=resolve;l.onerror=()=>reject(new Error('Не удалось загрузить '+path));document.head.append(l);});
const metric=r=>r.metrics||[];
window.TOYS_PLATFORM={asset,scheduleRender,updateChart,observeScrollFades,async fx(from,to){const d=await json(`${api}/exchange-rate?base=${from}&quote=${to}`);return Response.json({date:d.rate.date,[from.toLowerCase()]:{[to.toLowerCase()]:Number(d.rate.rate)}});},tabs:()=>tabsPromise,afterRender(){if(ready){attachHierarchy();maskUnavailable();calendar?.sync();renderCRM();renderCreatives();}},async table(name,raw){
 if(name==='WeeklyComments')return weeklyTable((await json(api+'/weekly-reports')).reports||[]);
 if(['GoogleAds','MetaAds','InstashopSales','EcomFunnel','EcomFunnelCampaign','Insights','MetaAdsFormat','QualifiedLeads'].includes(name))return sourceTable(await snapshotPromise,name);
 const path=`${api}/content/tabs?tab=${encodeURIComponent(name)}${raw?'&raw=1':''}`;return materialCache.get(path,()=>json(path));
}};
const numberFormat=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const format=n=>n==null?'—':numberFormat.format(n);
function selectedRows(){const r=range();return allRows.filter(row=>row.date>=r.from&&row.date<=r.to);}
function maskUnavailable(){
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
 refreshing=true;const seq=++sequence;notice('Обновляем рекламные кабинеты…');
 try{const result=await json(`${api}/${privateMode?'content-project/ads/hierarchy':'ads-summary'}?from=${requested.from}&to=${requested.to}`);if(seq!==sequence||JSON.stringify(range())!==JSON.stringify(requested))return;ads=result;crmStats=result.crm||null;renderCRM();
  const names=[...new Set((ads.providers||[]).map(p=>p.provider))].filter(name=>ads.providers.filter(p=>p.provider===name).every(p=>p.hierarchy&&p.requestedRange?.from===requested.from&&p.requestedRange?.to===requested.to));
  const normalized=advertisingModel(dashboard,ads,requested);const live=allRows.filter(r=>r.date>=requested.from&&r.date<=requested.to&&!names.includes(r.provider)).concat(normalized.filter(r=>names.includes(r.provider)));const base=allRows.filter(r=>r.date<requested.from||r.date>requested.to);const all=[...base,...live];
  let commerce=null;if(dashboard.ecommerce&&result.commerce?.completeProviders?.length){const updated=new Set(result.commerce.completeProviders.map(p=>p==='meta_ads'?'Meta Ads':'Google Ads'));for(const [key,rows]of [['account',result.commerce.account],['campaigns',result.commerce.campaigns]]){const previous=dashboard.ecommerce[key]||{};dashboard.ecommerce[key]={...previous,rows:[...(previous.rows||[]).filter(r=>!updated.has(r.platform)||r.date<requested.from||r.date>requested.to||(result.commerce.coverageByProvider?.[r.platform==='Meta Ads'?'meta_ads':'google_ads']&&!result.commerce.coverageByProvider[r.platform==='Meta Ads'?'meta_ads':'google_ads'].includes(r.date))),...rows]};}commerce={account:sourceTable(dashboard,'EcomFunnel'),campaigns:sourceTable(dashboard,'EcomFunnelCampaign')};}
  if(names.length||commerce){if(shop){const mapped=shopLiveRows(all);if(mapped.some(r=>r===null)){notice('Детализация получена. Для сводки в гривнах не хватает подтверждённого курса; сохранены опубликованные показатели.',true);attachHierarchy();return;}allRows=all;applyAds(mapped);}
  else {allRows=all;applyAds(all.map(r=>({date:r.date,platform:r.provider==='google_ads'?'Google Ads':'Meta Ads',account:title,accountId:r.integrationId||'',currency:r.currency,campaign:r.name,campaignId:r.campaignId,impr:r.impressions,clicks:r.clicks,cost:r.spend,conv:r.conversions})),commerce);}}
  if(result.refreshing){notice('Обновляем рекламные данные. Последние доступные показатели сохранены.');retrySoon('ads',requested,refresh);}
  else{clearTimeout(retryTimers.ads);notice(result.providers?.map(p=>`${p.provider==='google_ads'?'Google Ads':'Meta Ads'}: ${p.hierarchy?(p.freshness==='fresh'?'обновлено':p.freshness==='partial'?'история + данные API':'сохранённые данные')+(p.fetchedAt?' · '+new Date(p.fetchedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):''):'подключение не завершено'}`).join(' · ')||'Показаны опубликованные данные.');}maskUnavailable();
 }catch(e){notice('Не удалось обновить кабинет. Последние данные сохранены; повторяем запрос автоматически.',true);retrySoon('ads',requested,refresh);}finally{refreshing=false;renderCreatives();if(JSON.stringify(range())!==JSON.stringify(requested))queueRefresh();}
}

function renderCRM(){
 let panel=$('platformCRMStats');if(!panel){const host=$('mainCards')||$('cards')||document.querySelector('#uxOverview .cards');if(!host)return;panel=document.createElement('div');panel.id='platformCRMStats';panel.className='cards';host.after(panel);}
 panel.hidden=!crmStats?.available;if(panel.hidden)return;
 const signature=JSON.stringify(crmStats);if(panel._renderSignature!==signature){panel._renderSignature=signature;panel.innerHTML=[['Квал-лиды CRM',format(crmStats.qualified)],['Продажи CRM',format(crmStats.sales)],['Выручка CRM',(crmStats.revenue||[]).map(r=>format(r.value)+' '+h(r.currency)).join('<br>')||'—']].map(([label,value])=>`<div class="card"><div class="label">${label}</div><div class="value">${value}</div></div>`).join('');}
 if(privateMode&&!$('platformCRMLink')){const link=document.createElement('a');link.id='platformCRMLink';link.href=api+'/content-crm';link.textContent='Открыть CRM';link.className='secondary';panel.after(link);}
}
function renderCreatives(){if(!ready)return;const channels=Object.keys(dashboard.advertising?.channels||{}).map(c=>/google/i.test(c)?'google_ads':'meta_ads');renderTopCreatives({rankings:creativeRankings,state:creativeState,activeChannel:document.querySelector('#platformSeg .active')?.dataset.platform||'__all',range:range(),channels:channels.length?[...new Set(channels)]:['meta_ads'],slug});}
async function refreshCreatives(){
 const requested=range(),seq=++creativeSequence;if(!creativeRankings)creativeState='loading';renderCreatives();
 try{const data=await json(`${api}/top-creatives?from=${requested.from}&to=${requested.to}`);if(seq!==creativeSequence||JSON.stringify(range())!==JSON.stringify(requested))return;creativeRankings=data.rankings;creativeState=data.refreshing?'refreshing':'ready';if(data.refreshing)retrySoon('creatives',requested,refreshCreatives);else clearTimeout(retryTimers.creatives);}
 catch{if(seq!==creativeSequence)return;creativeState='error';retrySoon('creatives',requested,refreshCreatives);}
 finally{if(seq===creativeSequence)renderCreatives();}
}
function queueRefresh(){resetRetries();crmStats=null;renderCRM();creativeSequence++;creativeRankings=null;creativeState='loading';clearTimeout(periodTimer);periodTimer=setTimeout(()=>{renderCreatives();refreshCreatives();refresh();},300);}
let lastAutoRefresh=Date.now(),autoRunning=false;
async function autoRefresh(){
 if(autoRunning||document.hidden||Date.now()<nextRefreshAt(lastAutoRefresh)+60000)return;autoRunning=true;lastAutoRefresh=Date.now();resetRetries();materialCache.clear();
 try{const d=await json(api+'/dashboard');const changed=JSON.stringify(d.dashboard)!==JSON.stringify(dashboard);dashboard=d.dashboard;snapshotPromise=Promise.resolve(dashboard);if(changed){appliedAds='';allRows=snapshotRows(dashboard);const names=['MetaAds','GoogleAds','InstashopSales','EcomFunnel','EcomFunnelCampaign'];window.TOYS_NATIVE.refreshSnapshot(Object.fromEntries(names.map(n=>[n,sourceTable(dashboard,n)])));}await Promise.all([refresh(),refreshCreatives()]);campaignBrowser?.refresh();}catch(e){notice('Автообновление временно недоступно. Сохранены последние данные.',true);}finally{autoRunning=false;}
}

function mountTools(){
 if(!$('platformClientNav')){const nav=document.createElement('aside');nav.id='platformClientNav';nav.setAttribute('aria-label','Разделы кабинета');nav.innerHTML=`<a id="platformHomeNav" class="active" aria-current="page" href="${prefix}/${encodeURIComponent(slug)}/"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg><span>Главная</span></a><a id="platformCRMNav" href="${api}/content-crm"><svg viewBox="0 0 24 24"><path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z"/></svg><span>CRM</span></a>`;const account=document.createElement('a');account.id='platformAccountNav';account.href=privateMode?prefix+'/api/v2/portal/session?choose=1':'/login';account.textContent=privateMode?'Аккаунт':'Войти';nav.append(account);document.body.append(nav);document.body.classList.add('platform-client-shell');const style=document.createElement('style');style.textContent=clientShellStyle;document.head.append(style);const mobileAccount=account.cloneNode(false);mobileAccount.id='platformMobileAccount';mobileAccount.setAttribute('aria-label',privateMode?'Мой аккаунт':'Войти в TOYS');mobileAccount.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg>';document.querySelector('body > header')?.append(mobileAccount);mountMobileKeyboard();}


 // Replace only the old editing workflow; the native navigation/panels stay in place.
 $('weeklyModal')?.remove();
 const weeklyHost=$('weeklyPanel')||$('weekly')?.closest('.panel');
 if(weeklyHost){weeklyHost.classList.remove('hidden');weeklyHost.classList.add('toys-tools');weeklyHost.querySelectorAll(':scope > *').forEach(n=>n.hidden=true);weeklyHost.insertAdjacentHTML('beforeend','<div id="weeklyContent"></div><div id="weeklyArchive"></div>');}
 document.body.insertAdjacentHTML('beforeend','<dialog id="history" class="toys-tools"><div class="panel-title"><h2>История отчёта</h2><button type="button" data-close>Закрыть</button></div><div id="historyContent"></div></dialog>');
 let project=$('projectView');
 if(!project&&shop){project=document.createElement('section');project.id='uxProject';project.className='ux-section';project.innerHTML='<div class="ux-page-heading"><div><p>РАБОТА ПО ПРОЕКТУ</p><h1>Проект</h1></div></div><div id="uxProjectChannels" class="ux-project-channels"><button type="button" data-legacy-view="meta" class="active">Meta</button></div>';$('content').append(project);const nav=document.createElement('button');nav.type='button';nav.dataset.uxView='project';nav.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 7.5h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11Z"/><path d="M8 7.5V5.8A2.3 2.3 0 0 1 10.3 3.5h3.4A2.3 2.3 0 0 1 16 5.8v1.7M4 12h16"/></svg><span>Проект</span>';$('uxNav').append(nav);}
 const creative=document.createElement('section');creative.className='toys-tools panel';creative.id='platformCreatives';creative.hidden=true;creative.innerHTML='<h2>Креативы Meta</h2><div id="creativeContent"></div>';project?.append(creative);
 const channels=$('uxProjectChannels');
 const syncCreatives=()=>{const selected=channels?.querySelector('.active');const meta=(selected?.dataset.legacyView||selected?.dataset.channel)==='meta';creative.hidden=!meta;if(meta)toolkit.loadCreatives();};
 document.addEventListener('click',e=>{if(e.target.closest('#uxProjectChannels button,[data-ux-view="project"]'))queueMicrotask(syncCreatives);});
 toolkit=tools({api,range,notify:notice,privateMode});syncCreatives();if(shop&&entryHash==='#meta'){$('uxNav')?.querySelector('[data-ux-view="project"]')?.click();syncCreatives();}
 if(!privateMode||window.TOYS_ACCESS_ROLE==='viewer'){document.querySelectorAll('#uxWeeklyAdd,#openWeekly').forEach(n=>n.hidden=true);}
 document.addEventListener('click',e=>{if(e.target.closest('#uxWeeklyAdd,#openWeekly')){e.preventDefault();e.stopImmediatePropagation();$('uxNav')?.querySelector('[data-ux-view="weekly"]')?.click();toolkit.loadWeekly();$('weeklyContent')?.scrollIntoView({block:'start'});}if(e.target.closest('[data-ux-view="weekly"]')){toolkit.loadWeekly();toolkit.loadWeeklyArchive();}},true);
 if(location.hash==='#weekly'||location.pathname.endsWith('/content-editor')){$('uxNav')?.querySelector('[data-ux-view="weekly"]')?.click();toolkit.loadWeekly();toolkit.loadWeeklyArchive();}
}
async function boot(){
 if(initialCRM)history.replaceState(null,'',location.pathname+location.search+'#overview');
 const legacy=new URLSearchParams(location.hash.slice(1));if(legacy.has('section')){const names={overview:'overview',campaigns:'campaigns',funnel:'funnel',weekly:'weekly',materials:'project',project:'project'};const route=legacy.get('view')==='campaigns'?'campaigns':names[legacy.get('section')]||'overview';history.replaceState(null,'',location.pathname+location.search+'#'+route);}

 // Font availability must never prevent the dashboard and data from opening.

 const channels=projectConfig.channels.map(key=>({key,label:{smm:'SMM',meta:'Meta',google:'Google'}[key]}));
 document.title=`TOYS × ${title} — Дашборд результатов`;const icon=document.createElement('link');icon.rel='icon';icon.type='image/svg+xml';icon.href=window.TOYS_FAVICON||asset('assets/favicon.svg');document.head.append(icon);
 window.DASH_CONFIG={...(slug==='housevip-cxp7'?{spendFx:{from:'IDR',to:'EUR'}}:{}),title,locked:true,showDrafts:false,sheetId:'platform',projectSheetId:'platform',projectApiKey:'platform',projectChannels:channels,weeklyProjectKey:slug,weeklyFormUrl:'#platform-weekly',conversionLabel:projectConfig.conversionLabel||'Конверсии',conversionShortLabel:projectConfig.conversionShortLabel||'Конв.',platformExplicitTabs:projectConfig.explicitTabs===true};
 window.INSTASHOP_CONFIG={title,sheetId:'platform',weeklyFormUrl:'#platform-weekly'};
 snapshotPromise=json(api+'/dashboard').then(d=>dashboard=d.dashboard);tabsPromise=json(api+'/content/tabs').then(d=>d.tabs||[]);

 if(shop){await load('core/instashop-model.js');await load('core/instashop.js');css('core/ux-v2.css');await load('core/ux-v2-instashop.js');}
 else{await load(slug==='housevip-cxp7'?'housevip-cxp7/core.js':'core/core.js');$('weeklyPanel')?.classList.remove('hidden');css(slug==='housevip-cxp7'?'housevip-cxp7/ux-v2.css':'core/ux-v2.css');await load(slug==='housevip-cxp7'?'housevip-cxp7/ux-v2.js':'core/ux-v2.js');}
 await load('core/theme.js');await css('platform-tools.css');
 await snapshotPromise;allRows=snapshotRows(dashboard);await tabsPromise;
 await new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{if(['content','emptyState'].some(id=>$(id)&&!$(id).classList.contains('hidden')))resolve();else if(Date.now()-start>15000)reject(new Error('Данные не загрузились'));else setTimeout(poll,50);};poll();});
 const controls=$('controls')||document.querySelector('.controls');
 const n=document.createElement('div');n.id='platformNotice';n.className='platform-notice';n.setAttribute('role','status');controls.after(n);notice(dashboard.coverage?.warning||'Опубликованные данные проекта.');
 ready=true;mountTools();maskUnavailable();
 if(!allRows.length&&$('updated'))$('updated').textContent='Нет рекламной активности в загруженном периоде';
 clientNavigation=mountClientNavigation({slug,api,prefix,asset,initialCRM,onChange:async()=>{try{const requested=range(),d=await json(`${api}/crm/summary?from=${requested.from}&to=${requested.to}`);if(JSON.stringify(range())===JSON.stringify(requested)){crmStats=d;renderCRM();}}catch{}}});
 const from=$(shop?'from':'dateFrom'),to=$(shop?'to':'dateTo');
 calendar=mountCalendar({from,to,timeZone:projectConfig.periodTimezone,apply:(start,end)=>{document.querySelectorAll('#periodSeg button').forEach(b=>b.classList.remove('active'));sequence++;ads=null;window.TOYS_NATIVE.setPeriod(start,end);queueRefresh();}});
 if(projectConfig.defaultLastDays){const end=calendar.today(),start=new Date(Date.parse(end+'T12:00:00Z')-(projectConfig.defaultLastDays-1)*86400000).toISOString().slice(0,10);from.value=start;to.value=end;window.TOYS_NATIVE.setPeriod(start,end);calendar.sync();}
 const logo=document.querySelector('header img[alt="TOYS"]');const theme=()=>{if(logo)logo.src=asset(document.documentElement.dataset.theme==='light'?'assets/toys-black.svg':'assets/toys-logo.svg');};theme();new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 campaignBrowser=mountCampaignBrowser({slug,context:()=>({range:range(),provider:document.querySelector('#platformSeg .active')?.dataset.platform==='Google Ads'?'google_ads':document.querySelector('#platformSeg .active')?.dataset.platform==='Meta Ads'?'meta_ads':''})});
 delete document.body.dataset.platformLoading;document.body.dataset.platformReady='true';renderCreatives();
 await Promise.all([refresh(),refreshCreatives()]);refreshTimer=setInterval(autoRefresh,60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)autoRefresh();});
 document.addEventListener('change',e=>{if(e.target===from||e.target===to){sequence++;ads=null;queueRefresh();}},true);
 document.addEventListener('click',e=>{if(e.target.closest('[data-days]')){sequence++;ads=null;queueRefresh();}},true);
}
boot().catch(e=>{delete document.body.dataset.platformLoading;const n=document.createElement('p');n.setAttribute('role','alert');n.textContent='Не удалось загрузить борд: '+e.message;document.body.append(n);});
