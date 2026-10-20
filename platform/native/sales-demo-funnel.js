import {escapeHtml as h,validRange} from '../unified/model.js';
import styles from './sales-demo-funnel.css';
const nf=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const number=v=>v===null||v===undefined?'—':nf.format(v);
const percent=v=>v===null?'—':number(v)+'%';
export function mountSalesDemoFunnel({context,json,onData,onUnavailable}){
 const legacy=document.getElementById('funnel');if(!legacy)return {sync(){}};
 legacy.hidden=true;const host=document.createElement('div');host.id='demoSalesFunnel';legacy.after(host);
 const style=document.createElement('style');style.textContent=styles;document.head.append(style);
 document.getElementById('funnelTitle').textContent='Воронка до продажи';
 document.querySelectorAll('#uxFunnel *').forEach(el=>{if(!el.children.length&&el.textContent==='От показов и кликов до обращения.')el.textContent='От показов и кликов до квалификации и продажи.';});
 let key='',generation=0,pending=null;
 function render(data){
  if(!data.hasData){host.innerHTML='<p role="status">За выбранный период нет данных.</p>';return;}
  const t=data.totals;
  host.innerHTML=`<div class="demo-funnel-head"><span>Этап</span><span>Количество</span><span>От предыдущего этапа</span><span>От показов</span></div>${data.steps.map(s=>`<div class="demo-funnel-step" data-stage="${h(s.key)}"><strong>${h(s.label)}</strong><b>${number(s.value)}</b><div><small>От предыдущего этапа</small>${percent(s.previousRate)}</div><div><small>От показов</small>${percent(s.totalRate)}</div></div>`).join('')}<div class="demo-funnel-outcome"><span>Лид → продажа <b>${percent(t.saleRate)}</b></span><span>Квалификация → продажа <b>${percent(t.qualifiedSaleRate)}</b></span><span>Выручка CRM <b>${number(t.revenue)} EUR</b></span></div><p class="demo-funnel-method">Лиды, пришедшие за выбранный период, и их квалификации и продажи по истории CRM на текущий момент. Даты поступления — Тбилиси. ${t.reportedLeads!==t.leads?`Заявок в рекламе: ${number(t.reportedLeads)}; действующих лидов CRM: ${number(t.leads)}. `:''}${data.unmatchedLeads?`${number(data.unmatchedLeads)} лидов без соответствующей рекламной кампании включены в общую воронку. `:''}Проценты рассчитаны из сумм выбранного канала и периода.</p>`;
 }
 function sync(force=false){
  const next=context(),nextKey=JSON.stringify(next);if(!validRange(next.range.from,next.range.to))return;
  if(key===nextKey&&!force)return pending;
  key=nextKey;const id=++generation;onUnavailable();host.innerHTML='<p role="status">Считаем воронку до продажи…</p>';
  pending=(async()=>{try{const data=await json(next);if(id!==generation)return;render(data);onData(data);}catch{if(id!==generation)return;host.innerHTML='<p role="alert">Не удалось загрузить воронку. <button type="button">Повторить</button></p>';host.querySelector('button').onclick=()=>sync(true);}})();return pending;
 }
 document.getElementById('platformSeg')?.addEventListener('click',()=>queueMicrotask(()=>sync()));
 sync();return {sync};
}
