import {currencySymbol} from '../unified/currency.js';
import registry from '../projects.json' with {type:'json'};
import {escapeHtml as h,validRange} from '../unified/model.js';
import {responseCache} from './response-cache.js';
import {datasetPage} from './campaign-dataset.js';
import {openCreative} from './creative-viewer.js';
import {mountCampaignControls} from './campaign-controls-ui.js';
import styles from './campaign-browser.css';

const providers={meta_ads:'Meta',google_ads:'Google'};
const statuses={ACTIVE:'Активно',ENABLED:'Активно',PAUSED:'Пауза',CAMPAIGN_PAUSED:'Кампания на паузе',ADSET_PAUSED:'Группа на паузе',ARCHIVED:'В архиве',DELETED:'Удалено',REMOVED:'Удалено',DISAPPROVED:'Отклонено',PENDING_REVIEW:'На проверке',IN_PROCESS:'На проверке',WITH_ISSUES:'Есть замечания'};
const nf=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const number=value=>value===null||value===undefined?'—':nf.format(value);
const day=value=>value?value.slice(8)+'.'+value.slice(5,7)+'.'+value.slice(0,4):'';
export function mountCampaignBrowser({slug,context}){
 const section=document.getElementById('uxCampaigns'),legacy=document.getElementById('campList')||document.getElementById('campaigns');
 if(!section||!legacy)return {sync(){},refresh(){}};
 const style=document.createElement('style');style.textContent=styles;document.head.append(style);
 legacy.classList.add('platform-legacy-campaigns');
 const host=document.createElement('div');host.id='platformCampaignBrowser';host.dataset.salesDemo=String(registry[slug]?.synthetic===true);legacy.before(host);
 const demo=registry[slug]?.synthetic===true;
 const displayText=value=>String(value).replace(/\s*[·•∙]\s*/g,' / ');
 const commerce=slug==='karlovarska-sul-k4rm',columns=[['impressions','Показы'],['clicks','Клики'],['ctr','CTR'],['spend','Расход'],['conversions',demo?'Лиды CRM':'Результаты'],['cpa',demo?'Стоимость лида':'CPA'],...(demo?[['qualifiedLeads','Квалифицированы'],['qualificationRate','Лид → квал'],['sales','Продажи'],['qualifiedSaleRate','Квал → продажа'],['saleRate','Лид → продажа'],['revenue','Выручка CRM'],['cpql','Стоимость квала'],['cac','Стоимость продажи'],['crmRoas','ROAS CRM']]:[]),...(commerce?[['purchases','Покупки'],['roas','ROAS']]:[])];
 host.style.setProperty('--campaign-columns',columns.length);
 host.innerHTML=`<div class="campaign-toolbar"><nav class="campaign-breadcrumbs" aria-label="Уровни рекламной кампании"></nav><div class="campaign-filters"><label class="campaign-search"><span class="sr-only">Поиск кампаний, групп и объявлений</span><input type="search" placeholder="Кампания, группа или объявление" maxlength="120"></label><label><span class="sr-only">Сортировка</span><select aria-label="Сортировка кампаний"><option value="spend">По расходу</option><option value="impressions">По показам</option><option value="conversions">По результатам</option><option value="name">По названию</option></select></label></div></div><p class="campaign-source-note"></p><div class="campaign-level-summary"></div><div class="campaign-list" aria-live="polite"></div>`;
 const list=host.querySelector('.campaign-list'),crumbs=host.querySelector('.campaign-breadcrumbs'),note=host.querySelector('.campaign-source-note'),summary=host.querySelector('.campaign-level-summary');
 const cache=responseCache({prefix:`/api/v2/projects/${encodeURIComponent(slug)}/campaign-browser`}),pages=new Map(),nodes=new Map(),expanded=new Set(),loading=new Set(),errors=new Map();
 const mobile=matchMedia('(max-width:760px)');
 let scope='',current,query='',sort='spend',path=[],generation=0,searchTimer,dataset=null,source=null;
 const observedStatuses=new Map();
 const controls=mountCampaignControls({slug,render,onStatus(key,status){observedStatuses.set(key,status);render();}});
 const visible=()=>section.classList.contains('active')&&!document.body.classList.contains('platform-show-crm');
 const params=(parent='',offset=0)=>new URLSearchParams({...current.range,provider:current.provider||'',...(demo?{analytics:'crm-v1'}:{}),parent,q:query,sort,offset:String(offset)});
 const url=(parent,offset)=>`/api/v2/projects/${encodeURIComponent(slug)}/campaign-browser?${params(parent,offset)}&adsBasis=daily-v2${!parent?'&dataset=1':''}`;
 const selectedParent=()=>mobile.matches?path.at(-1)||'':'';
 function reset(clearDataset=true){if(clearDataset){dataset=null;source=null;}generation++;pages.clear();nodes.clear();loading.clear();errors.clear();expanded.clear();path=[];}
 function localPage(parent='',offset=0,limit=50){
  const page=datasetPage(dataset,{parent,offset,limit,provider:current.provider||'',query,sort});
  return page?{...source,sources:(source?.sources||[]).filter(s=>!current.provider||s.provider===current.provider),...page,dataset:undefined}:null;
 }
 function accept(data,parent,more){
  if(data.dataset){
   dataset=data.dataset;source={sources:data.sources,refreshing:data.refreshing,range:data.range};
   for(const row of dataset.rows)nodes.set(row.key,row);
   // Keep already displayed pagination and open levels when a new snapshot arrives.
   for(const [key,old] of pages){const page=localPage(key);if(page){const count=Math.max(50,old.rows.length);const full=datasetPage(dataset,{parent:key,provider:current.provider||'',query,sort,limit:count});pages.set(key,{...page,...full});}}
   data=localPage(parent,0,Math.max(50,pages.get(parent)?.rows.length||0))||data;
  }
  for(const row of data.rows)nodes.set(row.key,row);
  pages.set(parent,{...data,dataset:undefined,rows:more?[...(pages.get(parent)?.rows||[]),...data.rows]:data.rows});
 }
 async function load(parent='',more=false,force=false){
  if(loading.has(parent)||!current||!validRange(current.range.from,current.range.to))return;
  const offset=more?pages.get(parent)?.nextOffset:0;if(offset===null||offset===undefined)return;
  const local=!force&&localPage(parent,offset,more?50:Math.max(50,pages.get(parent)?.rows.length||0));if(local){accept(local,parent,more);render();return;}
  const seq=generation;loading.add(parent);errors.delete(parent);render();
  try{
   const address=url(parent,offset);
   const saved=await cache.load(address);if(seq!==generation)return;if(saved&&!more&&(!force||!pages.has(parent))){accept(saved.value,parent,false);render();}
   const data=await cache.get(address,async()=>{const response=await fetch(address,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(30000)});const d=await response.json();if(!response.ok||!d.ok)throw Object.assign(new Error(response.status===401||response.status===403?'access_denied':'unavailable'),{status:response.status});return d;},{force});
   if(seq!==generation)return;
   if(force&&!parent&&!data.dataset){dataset=null;source=null;}
   accept(data,parent,more);
  }catch(error){if(seq===generation&&[401,403].includes(error.status)){dataset=null;source=null;pages.clear();nodes.clear();expanded.clear();path=[];}
   if(seq===generation&&error.name!=='AbortError')errors.set(parent,error.message==='access_denied'?'Войдите в кабинет, чтобы открыть детализацию.':'Не удалось загрузить детализацию. Попробуйте ещё раз.');}
  finally{if(seq===generation){loading.delete(parent);render();}}
 }
 const metric=(row,[key,label])=>`<div class="campaign-cell"><span>${label}</span><b>${number(row.metrics[key])}${row.metrics[key]==null?'':['ctr','qualificationRate','qualifiedSaleRate','saleRate'].includes(key)?'%':['roas','crmRoas'].includes(key)?'×':['spend','cpa','revenue','cpql','cac'].includes(key)?' '+h(currencySymbol(row.currency)):''}</b></div>`;
 function rowHTML(row,depth){
  row={...row,status:observedStatuses.get(row.key)||row.status};
  const open=expanded.has(row.key),ad=row.level==='ad',expandable=!ad&&!row.history;
  const label=row.salesAnalytics?'Кампания · CRM до продажи':row.history?'История · только кампания':ad?'Объявление':row.level==='group'?(row.groupKind==='asset_group'?'Группа объектов':'Группа объявлений'):'Кампания';
  return `<article class="campaign-entity" data-node="${row.key}" style="--campaign-depth:${depth}"><div class="campaign-grid campaign-row"><div class="campaign-name-cell"><button type="button" class="campaign-node-open" data-action="${ad?'creative':expandable?'open':'history'}" data-key="${row.key}" ${expandable?`aria-expanded="${open}"`:''} aria-label="${ad?'Открыть объявление':expandable?'Открыть '+(row.level==='campaign'?'группы':'объявления'):'Историческая кампания'}: ${h(displayText(row.name))}">${ad?`<span class="campaign-thumbnail">${row.previewUrl?`<img src="${h(row.previewUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m5 18 5-6 4 4 3-3 4 5"/></svg>'}</span>`:`<span class="campaign-chevron" aria-hidden="true">${row.history?'':open&&!mobile.matches?'−':'+'}</span>`}<span class="campaign-name">${h(displayText(row.name))}<small>${h(displayText(`${providers[row.provider]||row.provider} · ${label}${row.status?' · '+(statuses[row.status]||row.status):''}`))}</small></span></button>${controls.button(row)}${row.history?`<span class="campaign-history-range">${day(row.from)} — ${day(row.to)}</span>`:''}</div>${columns.map(c=>metric(row,c)).join('')}</div>${!mobile.matches&&open?`<div class="campaign-children">${levelHTML(row.key,depth+1)}</div>`:''}</article>`;
 }
 function levelHTML(parent='',depth=0){
  const data=pages.get(parent),error=errors.get(parent);
  const errorHTML=error?`<div class="campaign-state" role="alert">${h(error)} <button type="button" data-action="retry" data-parent="${parent}">Повторить</button></div>`:'';
  if(error&&!data)return errorHTML;
  if(!data)return '<div class="campaign-state" role="status">Загружаем детализацию…</div>';
  const rows=data.rows.map(row=>rowHTML(row,depth)).join('');
  const empty=parent?'Источник не передал дочерние элементы за выбранный период. Итоги родительской строки сохранены.':query?'Ничего не найдено. Измените запрос.':'Нет рекламных данных за выбранный период.';
  return errorHTML+(rows||`<div class="campaign-state">${empty}</div>`)+(data.nextOffset!==null?`<button type="button" class="campaign-more" data-action="more" data-parent="${parent}" ${loading.has(parent)?'disabled':''}>${loading.has(parent)?'Загружаем…':displayText(`Показать ещё · ${data.rows.length} из ${data.total}`)}</button>`:'');
 }
 function render(){
  const focused=list.contains(document.activeElement)?document.activeElement:null,focusKey=focused?.dataset.key;
  const parent=selectedParent(),data=pages.get(parent),root=pages.get('');
  crumbs.innerHTML=`<button type="button" data-action="root" ${!parent?'aria-current="page"':''}>Кампании</button>${mobile.matches?path.map((key,i)=>`<span aria-hidden="true">/</span><button type="button" data-action="crumb" data-index="${i}" ${i===path.length-1?'aria-current="page"':''}>${h(displayText(nodes.get(key)?.name||'Группа'))}</button>`).join(''):''}`;
  const unavailable=(root?.sources||[]).filter(s=>!s.available).map(s=>providers[s.provider]);
  const partial=(root?.sources||[]).filter(s=>s.available&&s.coverage==='partial');
  note.textContent=unavailable.length?`Детализация ${[...new Set(unavailable)].join(', ')} пока недоступна. Сохранённая история показана отдельно.`:partial.length?'За часть периода доступна только история кампаний. Такие строки отмечены отдельно.':(root?.sources||[]).some(s=>s.freshness==='stale')?'Показана последняя сохранённая детализация.':root?.refreshing?'Обновляем детализацию. Последние данные сохранены.':'';
  const updated=(root?.sources||[]).map(s=>Date.parse(s.fetchedAt)).filter(Number.isFinite);
  if(updated.length){const at=new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Tbilisi',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(Math.min(...updated)));note.textContent+=(note.textContent?' / ':'')+'Обновлено '+at;}
  note.hidden=!note.textContent;
  summary.innerHTML=data?.parent?`<div class="campaign-parent-summary"><strong>${h(displayText(data.parent.name))}</strong><span>${h(displayText(`Расход ${number(data.parent.metrics.spend)} ${currencySymbol(data.parent.currency)} · Результаты ${number(data.parent.metrics.conversions)}`))}</span></div>`:'';
  list.innerHTML=`${!mobile.matches?`<div class="campaign-grid campaign-table-head"><span>${h(displayText(`Название · ${data?.total??'—'}`))}</span>${columns.map(c=>`<span>${c[1]}</span>`).join('')}</div>`:''}${levelHTML(parent)}`;
  list.querySelectorAll('img').forEach(img=>img.onerror=()=>img.remove());
  if(focusKey)list.querySelector(`[data-key="${focusKey}"]`)?.focus({preventScroll:true});
 }
 host.addEventListener('click',e=>{
  const button=e.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action,key=button.dataset.key,row=nodes.get(key);
  if(action==='control'&&row){controls.open(row,current.range,button);return;}
  if(action==='creative'&&row){openCreative({row:{...row,detailsKey:row.key},slug,range:current.range,trigger:button,endpoint:'campaign-browser'});return;}
  if(action==='history')return;
  if(action==='root'){path=[];render();return;}
  if(action==='crumb'){path=path.slice(0,Number(button.dataset.index)+1);render();return;}
  if(action==='retry'){cache.delete(url(button.dataset.parent,0));load(button.dataset.parent,false,true);return;}
  if(action==='more'){load(button.dataset.parent,true);return;}
  if(action==='open'){
   if(mobile.matches){path.push(key);render();host.scrollIntoView({block:'start'});}
   else {if(expanded.has(key)){expanded.delete(key);render();return;}expanded.add(key);}
   if(pages.has(key))render();else load(key);
  }
 });
 host.querySelector('input').addEventListener('input',e=>{clearTimeout(searchTimer);const value=e.target.value;searchTimer=setTimeout(()=>{query=value.trim();reset(false);if(visible())load();},250);});
 host.querySelector('select').addEventListener('change',e=>{sort=e.target.value;reset(false);if(visible())load();});
 mobile.addEventListener('change',()=>{for(const key of path)expanded.add(key);render();});
 function sync(){
  const next=context(),key=JSON.stringify(next);if(scope!==key){const sameRange=current&&JSON.stringify(current.range)===JSON.stringify(next.range);scope=key;current=next;reset(!sameRange);}
  if(!visible())return;
  if(!validRange(current.range.from,current.range.to)){list.innerHTML='<div class="campaign-state">Выберите период для детализации.</div>';return;}
  if(!pages.has('')&&!loading.has(''))load();
 }
 new MutationObserver(sync).observe(section,{attributes:true,attributeFilter:['class']});
 document.getElementById('platformSeg')?.addEventListener('click',()=>queueMicrotask(sync));
 sync();
 return {sync,async refresh(){generation++;loading.clear();errors.clear();if(visible()){const seq=generation;await load('',false,true);if(seq!==generation)return;for(const key of new Set([...expanded,...path]))load(key,false,!localPage(key));}else{reset();}}};
}
