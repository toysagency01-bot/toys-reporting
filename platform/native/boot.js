import {sourceTable,weeklyTable} from './data.js';
import {tools} from '../dist/native-tools.mjs';
import {advertisingModel,snapshotRows,campaignGroups,nodeTotals,aggregate,escapeHtml as h,validRange,valueOf} from '../unified/model.js';
const slug=window.TOYS_UNIFIED_PROJECT;
const prefix=location.pathname.startsWith('/mvp/')?'/mvp':'';
const api=`${prefix}/api/v2/projects/${slug}`;
// Use the same authenticated, forwarded route as the document. The Pages
// gateway does not necessarily forward arbitrary /api/ui/* asset paths.
const asset=path=>`${api}/content-project?ui=${encodeURIComponent(path)}`;
const shop=slug==='profkit-instashop-r4vk';
const title=({'housevip-cxp7':'HOUSEVIP','profkit-instashop-r4vk':'PROFKIT','karlovarska-sul-k4rm':'Karlovarska Sul'})[slug];
const $=id=>document.getElementById(id);
let dashboard,allRows=[],ads=null,snapshotPromise,tabsPromise,ready=false,toolkit,refreshing=false,sequence=0;
const json=async(url,options={})=>{const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});const d=await r.json();if(!r.ok||!(d.ok||d.status==='ok'))throw new Error(d.error||`HTTP ${r.status}`);return d;};
const range=()=>({from:$(shop?'from':'dateFrom')?.value||'',to:$(shop?'to':'dateTo')?.value||''});
function notice(text,error=false){const n=$('platformNotice');if(n){n.textContent=text;n.dataset.error=String(error);}}
const load=path=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=asset(path);s.onload=resolve;s.onerror=()=>reject(new Error('Не удалось загрузить '+path));document.head.append(s);});
const css=path=>new Promise((resolve,reject)=>{const l=document.createElement('link');l.rel='stylesheet';l.href=asset(path);l.onload=resolve;l.onerror=()=>reject(new Error('Не удалось загрузить '+path));document.head.append(l);});
const metric=r=>r.metrics||[];
window.TOYS_PLATFORM={asset,async fx(from,to){const d=await json(`${api}/exchange-rate?base=${from}&quote=${to}`);return Response.json({date:d.rate.date,[from.toLowerCase()]:{[to.toLowerCase()]:Number(d.rate.rate)}});},tabs:()=>tabsPromise,afterRender(){if(ready){attachHierarchy();maskUnavailable();}},async table(name,raw){
 if(name==='WeeklyComments')return weeklyTable((await json(api+'/weekly-reports')).reports||[]);
 if(['GoogleAds','MetaAds','InstashopSales','EcomFunnel','EcomFunnelCampaign','Insights','MetaAdsFormat','QualifiedLeads'].includes(name))return sourceTable(await snapshotPromise,name);
 return json(`${api}/content/tabs?tab=${encodeURIComponent(name)}${raw?'&raw=1':''}`);
}};
const format=n=>n==null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
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
function child(node,currency){const t=nodeTotals(node,range());return `<details class="platform-child"><summary>${h(node.name||'Объявление')}</summary><div class="camp-metrics">${[['Показы',t.impressions],['Клики',t.clicks],['Расход',t.spend],['Конверсии',t.conversions]].map(([l,v])=>`<div><span>${l}</span><b>${format(v)}${l==='Расход'&&v!=null?' '+h(currency):''}</b></div>`).join('')}</div>${(node.children||[]).map(n=>child(n,currency)).join('')}</details>`;}
function attachHierarchy(){
 const groups=campaignGroups(selectedRows());
 for(const row of document.querySelectorAll('#campList .camp-row,#campaigns .campaign')){
  row.querySelectorAll('.platform-drilldown').forEach(n=>n.remove());
  const name=row.querySelector('.camp-name,.campaign-name')?.textContent.trim();const matches=groups.filter(g=>g.name===name);
  if(!matches.some(g=>g.children?.length))continue;
  const host=document.createElement('details');host.className='platform-drilldown';host.innerHTML='<summary>Группы и объявления</summary>'+matches.map(g=>`<div>${h(g.provider==='google_ads'?'Google Ads':'Meta Ads')} · ${h(g.currency)}</div>`+(g.children||[]).map(n=>child(n,g.currency)).join('')).join('');row.append(host);
 }
}
function shopLiveRows(rows){
 // Native Instashop accounting is UAH. Use only the source's explicit daily FX.
 const facts=dashboard.instashop?.ads?.rows||[];
 return rows.map(r=>{let spend=r.spend,usd=null;if(r.currency==='USD'){const day=facts.filter(f=>f.date===r.date);const ratios=day.map(f=>{const u=metric(f).find(m=>m.metricCode==='ads.spend_uah'),d=metric(f).find(m=>m.metricCode==='ads.raw_spend_usd');return valueOf(d)>0&&valueOf(u)!=null?valueOf(u)/valueOf(d):null;}).filter(x=>x!==null);if(!ratios.length||Math.max(...ratios)-Math.min(...ratios)>0.01)return null;usd=spend;spend=spend==null?null:spend*ratios[0];}else if(r.currency!=='UAH')return null;
 return {date:r.date,platform:'Meta Ads',account:title,accountId:r.integrationId||'',currency:'UAH',campaign:r.name,impressions:r.impressions,clicks:r.clicks,spendUah:spend,metaDirect:r.conversions,spendUsd:usd,fx:usd>0?spend/usd:null};});
}
async function refresh(){
 if(refreshing)return;const requested=range();if(!validRange(requested.from,requested.to)||(Date.parse(requested.to)-Date.parse(requested.from))/86400000>=90){notice('Для обновления кабинета выберите период до 90 дней.',true);return;}
 refreshing=true;$('platformRefresh').disabled=true;const seq=++sequence;notice('Обновляем рекламные кабинеты…');
 try{const result=await json(`${api}/content-project/ads/refresh?from=${requested.from}&to=${requested.to}`,{method:'POST'});if(seq!==sequence||JSON.stringify(range())!==JSON.stringify(requested))return;ads=result;
  const names=[...new Set((ads.providers||[]).map(p=>p.provider))].filter(name=>ads.providers.filter(p=>p.provider===name).every(p=>p.hierarchy&&p.requestedRange?.from===requested.from&&p.requestedRange?.to===requested.to));
  const normalized=advertisingModel(dashboard,ads,requested);const live=allRows.filter(r=>r.date>=requested.from&&r.date<=requested.to&&!names.includes(r.provider)).concat(normalized.filter(r=>names.includes(r.provider)));const base=allRows.filter(r=>r.date<requested.from||r.date>requested.to);const all=[...base,...live];
  if(shop){const mapped=shopLiveRows(all);if(mapped.some(r=>r===null)){notice('Детализация получена. Для сводки в гривнах не хватает подтверждённого курса; сохранены опубликованные показатели.',true);attachHierarchy();return;}allRows=all;window.TOYS_NATIVE.refreshAds(mapped);}
  else {allRows=all;window.TOYS_NATIVE.refreshAds(all.map(r=>({date:r.date,platform:r.provider==='google_ads'?'Google Ads':'Meta Ads',account:title,accountId:r.integrationId||'',currency:r.currency,campaign:r.name,campaignId:r.campaignId,impr:r.impressions,clicks:r.clicks,cost:r.spend,conv:r.conversions})));}
  notice(result.providers?.map(p=>`${p.provider==='google_ads'?'Google Ads':'Meta Ads'}: ${p.hierarchy?(p.freshness==='fresh'?'обновлено':'сохранённые данные'):'подключение не завершено'}`).join(' · ')||'Показаны опубликованные данные.');maskUnavailable();
 }catch(e){notice(`Не удалось обновить кабинет. Сохранены опубликованные данные. ${e.message}`,true);}finally{refreshing=false;$('platformRefresh').disabled=false;}
}
function mountTools(){
 // Replace only the old editing workflow; the native navigation/panels stay in place.
 $('weeklyModal')?.remove();
 const weeklyHost=$('weeklyPanel')||$('weekly')?.closest('.panel');
 if(weeklyHost){weeklyHost.classList.remove('hidden');weeklyHost.classList.add('toys-tools');weeklyHost.querySelectorAll(':scope > *').forEach(n=>n.hidden=true);weeklyHost.insertAdjacentHTML('beforeend','<div id="weeklyContent"></div><div id="weeklyArchive"></div>');}
 document.body.insertAdjacentHTML('beforeend','<dialog id="history" class="toys-tools"><div class="panel-title"><h2>История отчёта</h2><button type="button" data-close>Закрыть</button></div><div id="historyContent"></div></dialog>');
 const project=$('projectView')||$('uxMethod');
 const creative=document.createElement('section');creative.className='toys-tools panel';creative.id='platformCreatives';creative.hidden=true;creative.innerHTML='<h2>Креативы</h2><div id="creativeContent"></div>';project?.append(creative);
 const channels=$('uxProjectChannels')||project;
 if(channels){const b=document.createElement('button');b.type='button';b.textContent='Креативы';b.dataset.platformCreatives='true';channels.append(b);b.onclick=()=>{for(const n of project.children){if(n!==creative&&n!==channels&&!n.classList.contains('ux-page-heading')){n.dataset.platformHidden=String(n.hidden);n.hidden=true;}}creative.hidden=false;toolkit.loadCreatives();};channels.addEventListener('click',e=>{if(e.target.closest('[data-platform-creatives]'))return;creative.hidden=true;for(const n of project.querySelectorAll('[data-platform-hidden]')){n.hidden=n.dataset.platformHidden==='true';delete n.dataset.platformHidden;}});}
 toolkit=tools({api,range,notify:notice});
 document.addEventListener('click',e=>{if(e.target.closest('#uxWeeklyAdd,#openWeekly')){e.preventDefault();e.stopImmediatePropagation();$('uxNav')?.querySelector('[data-ux-view="weekly"]')?.click();toolkit.loadWeekly();$('weeklyContent')?.scrollIntoView({block:'start'});}if(e.target.closest('[data-ux-view="weekly"]')){toolkit.loadWeekly();toolkit.loadWeeklyArchive();}},true);
 if(location.hash==='#weekly'||location.pathname.endsWith('/content-editor')){$('uxNav')?.querySelector('[data-ux-view="weekly"]')?.click();toolkit.loadWeekly();toolkit.loadWeeklyArchive();}
}
async function boot(){
 // Font availability must never prevent the dashboard and data from opening.
 await Promise.race([Promise.all([400,500,600,700,800].map(weight=>document.fonts.load(`${weight} 14px "Golos Text"`,'Обзор проекта TOYS 0123456789'))).catch(()=>{}),new Promise(resolve=>setTimeout(resolve,2500))]);
 const channels=slug==='housevip-cxp7'?[{key:'smm',label:'SMM'},{key:'meta',label:'Meta'}]:[{key:'smm',label:'SMM'},{key:'meta',label:'Meta'},{key:'google',label:'Google'}];
 document.title=`TOYS × ${title} — Дашборд результатов`;const icon=document.createElement('link');icon.rel='icon';icon.type='image/svg+xml';icon.href=asset('assets/favicon.svg');document.head.append(icon);
 window.DASH_CONFIG={...(slug==='housevip-cxp7'?{spendFx:{from:'IDR',to:'EUR'}}:{}),title,locked:true,showDrafts:false,sheetId:'platform',projectSheetId:'platform',projectApiKey:'platform',projectChannels:channels,weeklyProjectKey:slug,weeklyFormUrl:'#platform-weekly',conversionLabel:'Конверсии',conversionShortLabel:'Конв.'};
 window.INSTASHOP_CONFIG={title,sheetId:'platform',weeklyFormUrl:'#platform-weekly'};
 snapshotPromise=json(api+'/dashboard').then(d=>dashboard=d.dashboard);tabsPromise=json(api+'/content/tabs').then(d=>d.tabs||[]);
 await snapshotPromise;allRows=snapshotRows(dashboard);await tabsPromise;
 if(shop){await load('core/instashop-model.js');await load('core/instashop.js');css('core/ux-v2.css');await load('core/ux-v2-instashop.js');}
 else{await load(slug==='housevip-cxp7'?'housevip-cxp7/core.js':'core/core.js');css(slug==='housevip-cxp7'?'housevip-cxp7/ux-v2.css':'core/ux-v2.css');await load(slug==='housevip-cxp7'?'housevip-cxp7/ux-v2.js':'core/ux-v2.js');}
 await load('core/theme.js');
 await new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{if($('content')&&!$('content').classList.contains('hidden'))resolve();else if(Date.now()-start>15000)reject(new Error('Данные не загрузились'));else setTimeout(poll,50);};poll();});
 const controls=$('controls')||document.querySelector('.controls');const button=document.createElement('button');button.type='button';button.id='platformRefresh';button.className='ux-primary';button.textContent='Обновить';button.onclick=refresh;controls.append(button);
 const n=document.createElement('div');n.id='platformNotice';n.className='platform-notice';n.setAttribute('role','status');controls.after(n);notice(dashboard.coverage?.warning||'Опубликованные данные проекта.');
 await css('platform-tools.css');ready=true;mountTools();maskUnavailable();
 document.addEventListener('change',()=>{sequence++;ads=null;},true);
 document.addEventListener('click',e=>{if(e.target.closest('[data-days]')){sequence++;ads=null;}},true);
}
boot().catch(e=>{const n=document.createElement('p');n.setAttribute('role','alert');n.textContent='Не удалось загрузить борд: '+e.message;document.body.append(n);});
