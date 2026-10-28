import {escapeHtml as h} from '../unified/model.js';
import {currencySymbol} from '../unified/currency.js';
export function mountProjectGoals(dashboard){
 const goals=dashboard.project?.goals;if(!goals)return;const target=document.getElementById('uxOverview');if(!target)return;
 const panel=document.createElement('section');panel.className='panel';panel.style.marginTop='22px';panel.setAttribute('aria-label','Плановые показатели проекта');
 const label={leads:'Лиды',qualified:'Квал-лиды',sales:'Продажи',purchases:'Покупки',revenue:'Выручка'}[goals.metric]||'Результат';
 const n=v=>v==null?'Не задано':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v),money=v=>v==null?'Не задано':n(v)+' '+currencySymbol(goals.currency||'');
 panel.innerHTML=`<h2>Плановые показатели · месяц</h2><div class="managed-goals-grid">${[[label,goals.metric==='revenue'?money(goals.target):n(goals.target)],['Макс. стоимость результата',money(goals.maxCost)],['Рекламный бюджет',money(goals.budget)]].map(([title,value])=>`<div><span>${h(title)}</span><strong>${h(value)}</strong></div>`).join('')}</div><p style="color:var(--muted);font-size:12px;margin-top:14px">План из настроек проекта. Фактические показатели показаны выше.</p>`;
 const css=document.createElement('style');css.textContent='.managed-goals-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.managed-goals-grid span{display:block;color:var(--muted);font-size:12px;margin:12px 0 8px}.managed-goals-grid strong{font-size:20px;font-weight:500}@media(max-width:600px){.managed-goals-grid{grid-template-columns:1fr;gap:8px}}';document.head.append(css);target.append(panel);
}
