import {nodeTotals,valueOf,escapeHtml as h} from '../unified/model.js';
export function rankCreatives(providers,range,basis='leads'){
 const channels=new Map();
 for(const p of providers||[]){if(!p.hierarchy||p.requestedRange?.from!==range.from||p.requestedRange?.to!==range.to)continue;
  if(!channels.has(p.provider))channels.set(p.provider,new Map());const entries=channels.get(p.provider);
  for(const c of p.hierarchy.children||[])for(const g of c.children||[])for(const ad of g.children||[]){if(ad.level!=='ad')continue;const totals=nodeTotals(ad,range);const days=(ad.outcomeDaily||[]).filter(d=>d.date>=range.from&&d.date<=range.to);for(const key of ['leads','purchases','purchaseValue','qualifiedLeads']){const values=days.map(d=>valueOf(d.metrics?.[key]));totals[key]=values.length&&values.every(v=>v!==null)?values.reduce((a,b)=>a+b,0):null;}totals.qualifiedLeads=ad.crmQualifiedLeads?.from===range.from&&ad.crmQualifiedLeads?.to===range.to?valueOf(ad.crmQualifiedLeads):null;if(!(totals.impressions>0))continue;
   const key=[p.integrationId,p.hierarchy.currency,ad.creativeRef||ad.providerId].join(':');
   if(!entries.has(key))entries.set(key,{name:ad.name||'Креатив',previewUrl:ad.previewUrl||null,previewStatus:ad.previewStatus||null,currency:p.hierarchy.currency,totals:[],freshness:p.freshness});entries.get(key).totals.push(totals);
  }
 }
 return [...channels].map(([provider,entries])=>{const rows=[...entries.values()].map(r=>({...r,...Object.fromEntries(['impressions','clicks','spend','conversions','leads','purchases','purchaseValue','qualifiedLeads'].map(k=>[k,r.totals.every(t=>t[k]!==null)?r.totals.reduce((s,t)=>s+t[k],0):null]))}));
  const candidates=rows.map(r=>({...r,score:basis==='roas'?(r.spend>0&&r.purchaseValue!==null?r.purchaseValue/r.spend:null):r[basis],ctr:r.clicks===null?null:r.clicks/r.impressions*100})).filter(r=>r.score!==null);
  candidates.sort((a,b)=>b.score-a.score||b.impressions-a.impressions);
  return {provider,basis,rows:candidates.slice(0,3)};
 });
}
const number=v=>v===null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v);
const selected=new Map();
const options={roas:"ROAS",purchases:"Продажи",leads:"Лиды",qualifiedLeads:"Квал. лиды"};
export function renderTopCreatives({providers=[],rankings=null,state='ready',range,channels,slug,activeChannel='__all'}){
 document.querySelectorAll('.platform-top-creatives').forEach(n=>n.remove());

 const visibleChannels=activeChannel==='__all'?channels:channels.filter(p=>p===(activeChannel==='Google Ads'?'google_ads':'meta_ads'));
 for(const provider of visibleChannels){const key=slug+':'+provider;const basis=selected.get(key)||(slug==='karlovarska-sul-k4rm'?'roas':slug==='profkit-instashop-r4vk'?'purchases':'leads');const data=(rankings?.[basis]||rankCreatives(providers,range,basis)).find(c=>c.provider===provider);const label=provider==='google_ads'?'Google Ads':'Meta Ads';
  const section=document.createElement('section');section.className='panel platform-top-creatives';section.dataset.provider=provider;
  section.innerHTML=`<div class="top-heading"><h2>3 лучших креатива</h2>${channels.length>1?`<span>${label}</span>`:''}</div><div class="top-switches" role="group" aria-label="Показатель рейтинга">${Object.entries(options).map(([value,label])=>`<button type="button" data-ranking="${value}" aria-pressed="${value===basis}">${label}</button>`).join('')}</div><p class="top-basis">${state==='loading'?'Загружаем креативы…':state==='refreshing'?'Обновляем креативы из рекламного кабинета…':state==='error'?'Не удалось загрузить креативы. Повторим загрузку автоматически.':data?.rows.length?`По показателю «${options[basis]}» за выбранный период · ${basis==='qualifiedLeads'?'CRM':'рекламный кабинет'}`:data?.unavailable?'Детализация объявлений этого канала пока не подключена.':basis==='qualifiedLeads'?'Нет данных CRM: для рейтинга нужны квалификации, сопоставленные с объявлениями.':`Нет данных по показателю «${options[basis]}» на уровне креативов за этот период.`}</p><div class="top-grid">${(data?.rows||[]).map((r,i)=>`<article class="top-creative"><div class="creative-preview">${r.previewUrl&&/^https:\/\//.test(r.previewUrl)?`<img src="${h(r.previewUrl)}" alt="${h(r.name)}" loading="lazy" referrerpolicy="no-referrer">`:`<span>${r.previewStatus==='request_failed'?'Meta не отдала изображение':'У объявления нет доступного изображения'}</span>`}<b class="creative-rank">${i+1}</b></div><h3>${h(r.name)}</h3><div class="top-metrics"><span>${options[basis]}<b>${number(r.score)}${basis==='roas'?'×':''}</b></span><span>CTR<b>${number(r.ctr)}${r.ctr===null?'':'%'}</b></span><span>Расход<b>${number(r.spend)} ${h(r.currency)}</b></span></div>${r.freshness!=='fresh'?'<small>Последние доступные данные</small>':''}</article>`).join('')}</div>`;
  const channelCards=[...document.querySelectorAll('#ecomTopCards > .ecom-channel')];
  const parent=channels.length>1?(activeChannel!=='__all'&&channelCards.length===1?channelCards[0]:channelCards.find(n=>n.querySelector('.ecom-channel-title')?.textContent.trim()===label)):null;
  (parent||document.getElementById('uxOverview')).append(section);
  section.querySelectorAll('[data-ranking]').forEach(button=>button.onclick=()=>{selected.set(key,button.dataset.ranking);renderTopCreatives({providers,rankings,state,range,channels,slug,activeChannel});document.querySelector(`.platform-top-creatives[data-provider="${provider}"] [data-ranking="${button.dataset.ranking}"]`)?.focus();});
  section.querySelectorAll('img').forEach(img=>img.onerror=()=>{img.replaceWith(Object.assign(document.createElement('span'),{textContent:'Предпросмотр недоступен'}));});
 }
}
