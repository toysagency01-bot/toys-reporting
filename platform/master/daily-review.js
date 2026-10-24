import {currencySymbol,currencyText} from '../unified/currency.js';
import {escapeHtml as h} from '../unified/model.js';
import {responseCache} from '../native/response-cache.js';
import {reviewProjectIncluded} from './review-scope.js';

const labels={critical:'Срочно',attention:'Обратить внимание',healthy:'Стабильно',insufficient:'Мало данных'};
const confidence={high:'высокая',medium:'средняя',low:'низкая'};
const number=n=>n==null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
const day=d=>d?d.split('-').reverse().join('.'):'';
const period=p=>p?`${day(p.from)}${p.from===p.to?'':' — '+day(p.to)}`:'';
const provider=p=>p==='google_ads'?'Google Ads':'Meta Ads';
const badge=p=>`<span class="review-priority review-${h(p)}">${h(labels[p]||p)}</span>`;
function finding(f){
 return `<li class="review-finding review-${h(f.severity)}"><div class="review-finding-head">${badge(f.severity)}<strong>${h(f.title)}</strong></div>
 ${f.provider?`<p class="review-context">${provider(f.provider)} · ${f.path?.length?f.path.map(p=>h(p.name)).join(' → '):'Весь кабинет'}</p>`:''}
 ${f.period?`<p class="review-context">${period(f.period)} · сравнение: ${period(f.comparison)}</p>`:''}
 <p>${h(currencyText(f.evidence))}</p><p class="review-action">${h(f.recommendation)}</p>
 ${f.hypothesis?`<p class="review-context">Гипотеза: ${h(f.hypothesis)}</p>`:''}
 <p class="review-context">Уверенность: ${h(confidence[f.confidence]||'низкая')}${f.checkpoint?' · '+h(f.checkpoint):''}</p>
 ${f.hold?`<p class="review-context">${h(f.hold)}</p>`:''}</li>`;
}
function account(a){
 const metrics=a.day;
 return `<div class="review-account"><div><strong>${provider(a.provider)}</strong><small>${period(a.periods.day)} · ${h(a.timeZone)}${a.currency?' · '+h(currencySymbol(a.currency)):''}</small></div>
 ${!metrics?'<p class="note">Нет подтверждённого среза за этот день.</p>':`<dl class="review-numbers"><div><dt>Расход</dt><dd>${number(metrics.spend)} ${h(currencySymbol(a.currency))}</dd></div><div><dt>Результаты рекламы</dt><dd>${number(metrics.conversions)}</dd></div><div><dt>Цена результата</dt><dd>${number(metrics.cpa)} ${h(currencySymbol(a.currency))}</dd></div>${metrics.roas!=null?`<div><dt>ROAS покупок</dt><dd>${number(metrics.roas)}×</dd></div>`:''}</dl>`}
 ${a.checkedAt?`<small>Срез проверен ${h(new Date(a.checkedAt).toLocaleString('ru-RU',{timeZone:'Asia/Tbilisi',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))} · Тбилиси</small>`:''}</div>`;
}
function crmBlock(crm){
 if(!crm?.available)return '<p class="review-context">CRM: '+(crm?.error?'результаты временно недоступны.':'нет подключённых данных о квалификациях и продажах.')+'</p>';
 return `<div class="review-crm"><strong>CRM · ${period(crm.period)}</strong><p>Квалификации: ${number(crm.qualified)} · Продажи: ${number(crm.sales)} · Выручка: ${crm.revenue.length?crm.revenue.map(r=>number(r.value)+' '+h(currencySymbol(r.currency))).join(' / '):'—'}</p><small>По дате первого перехода в статус · ${h(crm.timeZone)}. Это события за день, а не текущие количества в воронке. Сопоставлено с рекламой: ${number(crm.matched)}; без подтверждённой привязки: ${number(crm.unmatched)}.</small></div>`;
}
function projectCard(report,filterProvider){
 const findings=report.findings.filter(f=>!filterProvider||!f.provider||f.provider===filterProvider),accounts=report.accounts.filter(a=>!filterProvider||a.provider===filterProvider);
 return `<article class="review-project review-${h(report.priority)}" data-review-project="${h(report.project.slug)}"><div class="review-project-head"><h3>${h(report.project.name)}</h3>${badge(report.priority)}</div><h4>${h(report.headline)}</h4><p>${h(report.recommendation)}</p>
 <details><summary>Цифры и рекомендации${findings.length?' · '+findings.length:''}</summary><div class="review-details">${accounts.map(account).join('')}${crmBlock(report.crm)}
 ${findings.length?`<ol class="review-findings">${findings.map(finding).join('')}</ol>`:''}
 <p class="review-context">${report.findingCount>report.findings.length?'Показаны наиболее значимые наблюдения. ':''}${report.limitations.map(h).join(' ')}</p>
 <a class="secondary" href="/${encodeURIComponent(report.project.slug)}/#campaigns">Открыть проект →</a></div></details></article>`;
}
export function mountDailyReview({host,json,isVisible=()=>true}){
 const savedReviews=responseCache({prefix:'/api/v2/master/daily-review',ttl:120000});
 const section=document.createElement('section');section.id='dailyReview';section.className='daily-review';section.setAttribute('aria-label','Утренний обзор проектов');host.prepend(section);
 section.innerHTML=`<div class="review-heading"><div><span class="review-eyebrow">TOYS Media-Buyer</span><h2>Утренний обзор</h2><p class="note">Каждый день в 09:30 · Тбилиси</p></div><label class="review-history">История обзоров<select aria-label="Дата утреннего обзора"><option value="">Последний обзор</option></select></label></div><p class="review-status" role="status">Загружаем сохранённый обзор…</p><div class="review-filters" aria-label="Срочность рекомендаций"></div><div class="review-projects"></div><p class="review-footer note">Рекомендации по правилам TOYS Media-Buyer. Настройки рекламы меняет команда после проверки.</p>`;
 const status=section.querySelector('.review-status'),list=section.querySelector('.review-projects'),filters=section.querySelector('.review-filters'),history=section.querySelector('select');
 let data=null,date='',priority='',slug='',filterProvider='',seq=0,lastLoad=0,pending=false,signature='',lastError=false;
 function render(){
  if(!data)return;
  const projects=data.reports.filter(r=>reviewProjectIncluded(r.project)&&(!slug||r.project.slug===slug)&&(!filterProvider||r.accounts.some(a=>a.provider===filterProvider)));
  const state=data.history.find(d=>d.date===data.reportDate)?.state;
  status.textContent=!data.reports.length?'Обзор ещё не сформирован. Плановый запуск — 09:30 по Тбилиси.':`Обзор от ${day(data.reportDate)} · ${projects.length} проектов · все каналы · последний закрытый день и предыдущие 7 дней.${state==='partial'?' Часть источников требует проверки — предупреждения внутри проектов.':''}${!date&&data.reportDate!==data.today?' Сегодняшний обзор пока не готов; показан предыдущий.':''}`;
  history.innerHTML='<option value="">Последний обзор</option>'+data.history.map(d=>`<option value="${h(d.date)}">${day(d.date)}</option>`).join('');history.value=date;
  filters.innerHTML=[['','Все'],...Object.entries(labels)].map(([key,label])=>`<button type="button" data-review-priority="${key}" class="${key?'review-'+key:''}" aria-pressed="${priority===key}">${h(label)} <span>${projects.filter(r=>!key||r.priority===key).length}</span></button>`).join('');
  const open=new Set([...list.querySelectorAll('details[open]')].map(el=>el.closest('[data-review-project]').dataset.reviewProject)),visible=projects.filter(r=>!priority||r.priority===priority);
  list.innerHTML=visible.map(r=>projectCard(r,filterProvider)).join('')||'<p class="note">В этой выборке нет проектов.</p>';
  for(const el of list.querySelectorAll('[data-review-project]'))if(open.has(el.dataset.reviewProject))el.querySelector('details').open=true;
 }
 async function load(force=false){
  if(pending||!force&&Date.now()-lastLoad<120000)return;pending=true;const current=++seq,requested=date;
  try{
   const address='/api/v2/master/daily-review'+(requested?'?date='+encodeURIComponent(requested):''),saved=await savedReviews.load(address);
   if(current!==seq)return;
   if(saved&&(!data||data.reportDate!==saved.value.reportDate)){data=saved.value;render();}
   const next=await savedReviews.get(address,()=>json(address),{force:lastError});if(current!==seq)return;
   data=next;lastLoad=Date.now();const key=JSON.stringify([requested,next.reportDate,next.history,next.counts,next.currentRun]);if(key!==signature||lastError){signature=key;render();}lastError=false;
  }catch(e){if(current===seq){lastError=true;lastLoad=0;if([401,403].includes(e.status)){data=null;list.replaceChildren();filters.replaceChildren();}status.textContent='Не удалось загрузить обзор. Повторим автоматически.'+(data?.reportDate?' Показан сохранённый обзор от '+day(data.reportDate)+'.':'');}}
  finally{if(current===seq)pending=false;}
 }
 history.onchange=()=>{date=history.value;seq++;pending=false;status.textContent='Загружаем обзор…';load(true);};
 filters.onclick=e=>{const button=e.target.closest('[data-review-priority]');if(button){priority=button.dataset.reviewPriority;render();}};
 setInterval(()=>{if(!document.hidden&&isVisible()&&(!date||lastError))load();},60000);
 return {load,setFilter(project,channel){if(project===slug&&channel===filterProvider)return;slug=project;filterProvider=channel;render();}};
}
