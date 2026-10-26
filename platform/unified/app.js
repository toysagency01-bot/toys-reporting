import {currencySymbol} from './currency.js';
import {escapeHtml as h, dateShift, validRange, advertisingModel, aggregate, campaignGroups, nodeTotals, businessMetrics, total} from './model.js';

const $ = id => document.getElementById(id);
const prefix = '';
const slug = window.TOYS_UNIFIED_PROJECT || location.pathname.match(/projects\/([^/]+)/)?.[1] || location.pathname.split('/').filter(Boolean).filter(s => s !== 'mvp')[0];
const api = `${prefix}/api/v2/projects/${slug}`;
const privateMode = window.TOYS_MVP_PROJECT_PORTAL === true;
const names = {'housevip-cxp7':'HOUSEVIP','profkit-instashop-r4vk':'PROFKIT INSTASHOP','karlovarska-sul-k4rm':'KARLOVARSKA SUL'};
const state = {view:'overview',dashboard:null,ads:null,range:null,rows:[],sequence:0,weekly:null,dirty:false,tabs:null,channel:null,tab:null};
const nf = new Intl.NumberFormat('ru-RU', {maximumFractionDigits:2});
const number = n => n == null ? '—' : nf.format(n);
const money = (n,c) => n == null ? '—' : `${number(n)} ${currencySymbol(c)}`.trim();
const status = (message, error = false) => { $('status').textContent = message; $('status').classList.toggle('error',error); };
const empty = text => `<div class="empty">${h(text)}</div>`;
const errors = {admin_role_required:'Удалять отчёты может только администратор.',report_changed:'Отчёт уже изменён в другой вкладке. Обновите список и проверьте актуальную версию.',report_storage_unavailable:'Хранилище скриншотов ещё не подключено.',report_storage_quota:'Лимит вложений проекта исчерпан. Обратитесь к администратору.',attachment_too_large:'Максимальный размер скриншота — 8 МБ.',invalid_image:'Выберите изображение PNG, JPEG или WebP.',attachment_upload_failed:'Не удалось загрузить скриншот. Повторите загрузку.',invalid_report_attachments:'Один из скриншотов недоступен. Загрузите его повторно.',invalid_report_channel:'Выберите Meta Ads, Google Ads или SMM.',revision_conflict:'Отчёт изменился в другой вкладке. Ваш текст сохранён на экране. Обновите историю перед повторным сохранением.',publication_conflict:'Опубликованная версия изменилась. Обновите историю отчёта.',provider_unauthorized:'Рекламный кабинет отклонил доступ.',provider_rate_limited:'Рекламный кабинет ограничил частоту запросов. Повторите позже.',refresh_rate_limited:'Обновление уже выполнялось недавно. Повторите через несколько секунд.',provider_adapter_unavailable:'Прямое подключение этого рекламного источника ещё не завершено.',active_ads_integration_missing:'Рекламный источник не подключён.',storage_quota_not_configured:'Лимит файлового хранилища ещё не настроен.',object_storage_binding_missing:'Файловое хранилище ещё не подключено.',invalid_date_range:'Выберите период не более 90 дней.',no_published_release:'У проекта пока нет опубликованных данных.',not_found:'Данные пока не созданы.'};
function explain(error) { return errors[error?.message || error] || (error?.status === 401 || error?.status === 403 ? 'Для этого действия войдите в проект.' : `Не удалось выполнить действие${error?.message ? `: ${error.message}` : ''}. Повторите попытку.`); }
async function json(url, options = {}) {
  const response = await fetch(url, {...options, credentials:'same-origin', cache:'no-store', headers:{...(options.body ? {'content-type':'application/json'} : {}), ...options.headers}});
  const body = await response.json().catch(() => null);
  if (!response.ok || !(body?.ok || body?.status==='ok' && body?.table)) {const error = new Error(body?.error || (response.redirected || /text\/html/.test(response.headers.get('content-type') || '') ? 'Требуется повторный вход' : `HTTP ${response.status}`));error.status=response.redirected ? 401 : response.status;throw error;}
  return body;
}
const write = async (path, body, key = crypto.randomUUID(), method = 'POST') => {const result=await json(api + path, {method, headers:{'x-idempotency-key':key},body:JSON.stringify(body)});window.TOYS_PLATFORM?.invalidate?.();return result;};
function today() {const timezone = state.dashboard?.project?.sourceTimezone || state.dashboard?.project?.reportingTimezone || 'UTC';try{return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch{return new Date().toISOString().slice(0,10);}}
function requestedRange() {return {from:$('dateFrom').value,to:$('dateTo').value};}
function updatePresets(days) { document.querySelectorAll('[data-days]').forEach(b => b.classList.toggle('active',Number(b.dataset.days) === days)); }
function preset(days) {const end=dateShift(today(),-1);$('dateFrom').value=dateShift(end,1-days);$('dateTo').value=end;updatePresets(days);}
function rangeText(r = state.range) {return r ? `${r.from} — ${r.to}` : '';}
function renderStatus() {
  const providers=state.ads?.providers || [];
  const details=providers.map(p => {
    const label=p.provider === 'google_ads' ? 'Google Ads' : 'Meta Ads';
    const freshness=p.freshness === 'fresh' ? 'обновлено' : p.hierarchy ? 'сохранённые данные' : 'не подключён';
    return `${label}: ${freshness}${p.fetchedAt ? ' '+new Date(p.fetchedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) : ''}${p.errorCode ? ' · '+(errors[p.errorCode] || 'ошибка обновления') : ''}`;
  });
  const snapshotUsed=state.rows.some(r=>r.source === 'snapshot');
  if(snapshotUsed || !providers.length) details.push(`Опубликованные данные${state.dashboard?.coverage?.freshness==='stale' ? ' · требуют обновления' : ''}`);
  const unsupported=providers.some(p=>p.hierarchy && p.metricAvailability?.conversions === 'unsupported');
  if(unsupported) details.push('Конверсии API пока не подтверждены — показаны прочерком');
  status(details.join(' · ') || 'За выбранный период данных нет.');
  $('updated').textContent=rangeText();
}
async function load(force = false) {
  const range=requestedRange();
  if(!validRange(range.from,range.to) || (Date.parse(range.to)-Date.parse(range.from))/86400000 >= 90 || range.to > today()) {status('Выберите корректный период до 90 дней, не позже сегодняшней даты.',true);return;}
  const sequence=++state.sequence;
  status(`Загружаем ${rangeText(range)}…${state.range ? ' На экране пока '+rangeText(state.range)+'.' : ''}`);
  $('refresh').disabled=true;
  try {
    const snapshot=await json(`${api}/dashboard?from=${range.from}&toExclusive=${dateShift(range.to,1)}`);
    if(sequence!==state.sequence)return;
    state.dashboard=snapshot.dashboard;state.range=range;state.ads=null;
    state.rows=advertisingModel(state.dashboard,null,range);renderAnalytics();renderStatus();
    if(privateMode){
      status('Проверяем рекламные кабинеты…');
      try {
        const ads=await json(`${api}/content-project/ads/${force ? 'refresh' : 'hierarchy'}?from=${range.from}&to=${range.to}`,{method:force?'POST':'GET'});
        if(sequence!==state.sequence)return;
        state.ads=ads;state.rows=advertisingModel(state.dashboard,ads,range);renderAnalytics();renderStatus();
      }catch(error){if(sequence===state.sequence)status(`${explain(error)} Показаны опубликованные данные за ${rangeText(range)}.`,true);}
    }
  }catch(error){if(sequence===state.sequence)status(`${explain(error)}${state.range ? ' На экране остаётся период '+rangeText(state.range)+'.' : ''}`,true);}
  finally{if(sequence===state.sequence)$('refresh').disabled=false;}
}
function kpi(label,value,note=''){return `<article class="panel kpi"><span class="label">${h(label)}</span><div class="value">${value}</div>${note?`<small>${h(note)}</small>`:''}</article>`;}
function renderAnalytics(){
  const totals=aggregate(state.rows);const spend=totals.money.map(m=>h(money(m.spend,m.currency))).join('<br>') || '—';
  $('kpis').innerHTML=kpi('Расход',spend)+kpi('Показы',number(totals.impressions))+kpi('Клики',number(totals.clicks))+kpi('CTR',totals.impressions && totals.clicks!=null ? number(totals.clicks/totals.impressions*100)+'%' : '—');
  const cpa=totals.money.length===1 && totals.money[0].spend!=null && totals.conversions>0 ? money(totals.money[0].spend/totals.conversions,totals.money[0].currency) : '—';
  const row=(l,v)=>`<div class="summary-row"><span>${h(l)}</span><b>${v}</b></div>`;
  $('periodSummary').innerHTML=row('Конверсии источника',number(totals.conversions))+row('Стоимость конверсии',h(cpa))+row('Расход',spend)+`<p class="note">${h(rangeText())}<br>${state.rows.some(r=>r.conversions==null) ? 'Конверсии не определены для части данных. Они не приравниваются к нулю.' : 'Конверсии рекламной системы. Фактические продажи и квалификация учитываются отдельно.'}</p>`;
  const groups=campaignGroups(state.rows);
  $('campaignList').innerHTML=groups.length ? groups.map(g=>campaignHtml(g)).join('') : empty('Кампаний за выбранный период нет. Попробуйте другой период.');
  renderChart(totals);renderFunnel(totals);renderBusiness();
}
function campaignMetrics(t,currency) {return `<div class="campaign-metrics">${[['Расход',money(t.spend,currency)],['Показы',number(t.impressions)],['Клики',number(t.clicks)],['Конверсии',number(t.conversions)]].map(([l,v])=>`<div><span class="label">${l}</span><strong>${h(v)}</strong></div>`).join('')}</div>`;}
function childHtml(node,currency){const t=nodeTotals(node,state.range);return `<details class="campaign"><summary><div class="campaign-heading"><b>${h(node.name || (node.level==='ad'?'Объявление':'Группа'))}</b><span class="badge">${node.level==='ad'?'Объявление':'Группа'}</span></div>${campaignMetrics(t,currency)}${node.children?.length?'<div class="expand-hint">Раскрыть объявления ↓</div>':''}</summary>${node.children?.length?`<div class="children">${node.children.map(n=>childHtml(n,currency)).join('')}</div>`:'<div class="children note">Рекламные показатели выбранного объявления.</div>'}</details>`;}
function campaignHtml(group){const t=group.totals;return `<details class="campaign" data-campaign="${h(group.campaignId)}"><summary><div class="campaign-heading"><b>${h(group.name)}</b><span class="badge">${group.provider==='google_ads'?'Google Ads':'Meta Ads'}</span></div>${campaignMetrics({...t,spend:t.money[0]?.spend},group.currency)}<div class="expand-hint">${group.children?.length?'Группы и объявления ↓':'Подробности ↓'}</div></summary><div class="children">${group.children?.length?group.children.map(n=>childHtml(n,group.currency)).join(''):`<p class="note">${privateMode ? 'Детализация появится после успешного подключения рекламного источника.' : 'Группы и объявления доступны в авторизованном режиме.'}</p>`}</div></details>`;}
function renderChart(totals){
  const dates=[...new Set(state.rows.map(r=>r.date))].sort();
  if(!dates.length){$('chart').innerHTML=empty('Нет данных для графика');$('chartLegend').textContent='';return;}
  // Clicks allow a truthful single chart even when accounts have different currencies.
  const values=dates.map(d=>total(state.rows.filter(r=>r.date===d),'clicks'));
  const max=Math.max(...values.filter(v=>v!=null),1);const width=780,height=200;
  const points=values.map((v,i)=>v==null?null:[dates.length===1?width/2:20+i*(width-40)/(dates.length-1),height-15-v/max*(height-35)]);
  const paths=[];let path='';points.forEach(p=>{if(!p){if(path)paths.push(path);path='';}else path+=`${path?' L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`;});if(path)paths.push(path);
  $('chartLegend').textContent='Клики';
  $('chart').innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Клики по дням"><g stroke="var(--line)">${[30,80,130,185].map(y=>`<line x1="0" y1="${y}" x2="780" y2="${y}"/>`).join('')}</g>${paths.map(d=>`<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="3"/>`).join('')}${points.map((p,i)=>p?`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="var(--accent)"><title>${dates[i]}: ${number(values[i])} кликов</title></circle>`:'').join('')}</svg><div class="chart-labels"><span>${dates[0]}</span><span>${dates.at(-1)}</span></div>`;
}
function renderFunnel(t){const max=Math.max(t.impressions || 0,t.clicks || 0,t.conversions || 0,1);$('funnelContent').innerHTML=[['Показы',t.impressions],['Клики',t.clicks],['Конверсии',t.conversions]].map(([label,v])=>`<div class="flow-row"><span>${label}</span><div class="flow-bar">${v!=null?`<i style="width:${Math.max(1,v/max*100)}%"></i>`:''}</div><b>${number(v)}</b></div>`).join('')+'<p class="note">Рекламные конверсии не равны подтверждённым продажам. Для неизвестного показателя оставлен прочерк.</p>';}
const metricLabels={'instashop.sales_count':'Продажи','instashop.revenue':'Выручка','instashop.revenue_uah':'Выручка','instashop.direct_inquiries':'Все обращения','instashop.qualified_inquiries':'Квалифицированные обращения','instashop.unqualified_inquiries':'Неквалифицированные обращения','ecom.add_to_cart':'Добавления в корзину','ecom.checkout':'Начатые оформления','ecom.purchases':'Покупки','ecom.purchase_value':'Выручка'};
function renderBusiness(){const metrics=businessMetrics(state.dashboard,state.range);$('business').hidden=!metrics.length;if(!metrics.length)return;$('business').innerHTML='<h2>Результаты бизнеса</h2><p class="note">Отдельные данные проекта. Не распределяются автоматически по рекламным кампаниям.</p><div class="kpis">'+metrics.filter(m=>metricLabels[m.code]).map(m=>kpi(metricLabels[m.code],h(money(m.value,m.currency)))).join('')+'</div>';}
function show(view){if(!['overview','campaigns','funnel','weekly','project','creatives'].includes(view) || view==='creatives'&&!privateMode)view='overview';state.view=view;document.querySelectorAll('.view').forEach(n=>n.classList.toggle('active',n.id===view));document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view===view));$('periodForm').hidden=['weekly','project','creatives'].includes(view);if(view==='weekly'){loadWeekly();loadWeeklyArchive();}if(view==='project')loadProject();if(view==='creatives')loadCreatives();}

// Weekly uses the existing revision and publication API. A save never publishes implicitly.
const fields=[['summary','Главный итог'],['wins','Что сработало'],['issues','Риски и вопросы'],['changes','Что изменили'],['nextSteps','План на следующую неделю']];
const reportChannels={meta:'Meta Ads',google:'Google Ads',smm:'SMM'};
const hasReportText=value=>value!=null&&!['','-','–','—'].includes(String(value).trim());
function reportFields(p,{includeSummary=false}={}){return fields.filter(([key])=>(includeSummary||key!=='summary')&&hasReportText(p[key])).map(([key,label])=>`<div class="report-field" data-field="${key}"><h3>${label}</h3><p>${h(p[key])}</p></div>`).join('');}
function reportSummary(p){return hasReportText(p.summary)?`<div class="report-main-summary"><span class="report-summary-label">Главный итог</span><p class="report-summary-text">${h(p.summary)}</p></div>`:'';}
function reportPeriod(start,end){
 const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value));
 if(!valid(start)||!valid(end))return [start,end].filter(Boolean).join(' — ')||'Период не указан';
 const date=value=>new Date(value+'T12:00:00Z'),format=(value,options)=>new Intl.DateTimeFormat('ru-RU',{timeZone:'UTC',...options}).format(date(value));
 if(start===end)return format(start,{day:'numeric',month:'long',year:'numeric'});
 if(start.slice(0,7)===end.slice(0,7))return Number(start.slice(8))+'–'+format(end,{day:'numeric',month:'long',year:'numeric'});
 return format(start,{day:'numeric',month:'long',...(start.slice(0,4)!==end.slice(0,4)?{year:'numeric'}:{})})+' — '+format(end,{day:'numeric',month:'long',year:'numeric'});
}
function groupReportRows(entries){
 const groups=new Map();for(const entry of entries){const key=JSON.stringify([entry.p.periodStart||'',entry.p.periodEnd||'']);if(!groups.has(key))groups.set(key,{start:entry.p.periodStart||'',end:entry.p.periodEnd||'',entries:[]});groups.get(key).entries.push(entry);}
 return [...groups.values()].sort((a,b)=>b.end.localeCompare(a.end)||b.start.localeCompare(a.start)).map(g=>`<section class="report-week"><h2 class="report-week-title">${h(reportPeriod(g.start,g.end))}</h2>${g.entries.map(e=>e.html).join('')}</section>`).join('');
}
let weeklyQuery='',weeklyChannel='',reportMenusBound=false;
function reportMenu(button){return button?`<div class="report-action-menu"><button type="button" class="quiet" data-report-menu aria-expanded="false">Действия</button><div class="report-action-popover" hidden>${button}</div></div>`:'';}
function bindReportMenus(){
 if(reportMenusBound)return;reportMenusBound=true;
 const close=menu=>{menu.querySelector('[data-report-menu]').setAttribute('aria-expanded','false');menu.querySelector('.report-action-popover').hidden=true;};
 document.addEventListener('click',e=>{const trigger=e.target.closest('[data-report-menu]'),menu=trigger?.closest('.report-action-menu');for(const other of document.querySelectorAll('.report-action-menu'))if(other!==menu&&!other.contains(e.target))close(other);if(trigger){const opened=trigger.getAttribute('aria-expanded')==='true';trigger.setAttribute('aria-expanded',String(!opened));menu.querySelector('.report-action-popover').hidden=opened;}});
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const menu=e.target.closest('.report-action-menu');if(menu){close(menu);menu.querySelector('[data-report-menu]').focus();}});
}
function applyReportFilters(){
 const q=weeklyQuery.trim().toLocaleLowerCase();let count=0;
 for(const host of [$('weeklyContent'),$('weeklyArchive')].filter(Boolean))for(const group of host.querySelectorAll('.report-week')){
  let shown=0;for(const report of group.querySelectorAll('.weekly-report')){const match=(!weeklyChannel||report.dataset.channel===weeklyChannel)&&(!q||report.textContent.toLocaleLowerCase().includes(q));report.hidden=!match;if(match)shown++;}group.hidden=!shown;count+=shown;
 }
 const archiveTitle=$('weeklyArchive')?.querySelector('.report-archive-title');if(archiveTitle)archiveTitle.hidden=![...$('weeklyArchive').querySelectorAll('.weekly-report')].some(r=>!r.hidden);
 if($('weeklyFilterEmpty'))$('weeklyFilterEmpty').hidden=!!count||(!q&&!weeklyChannel);
 if($('weeklyReportCount'))$('weeklyReportCount').textContent='Отчётов: '+count;
}
function weeklyBrowserTools(){return `<div class="report-browser-tools"><label class="report-search"><span class="sr-only">Поиск по тексту отчётов</span><input id="weeklySearch" type="search" placeholder="Поиск по тексту отчётов" value="${h(weeklyQuery)}" maxlength="200"></label><label><span class="sr-only">Канал отчёта</span><select id="weeklyChannel"><option value="">Все каналы</option>${Object.entries(reportChannels).map(([key,label])=>`<option value="${key}" ${weeklyChannel===key?'selected':''}>${label}</option>`).join('')}</select></label><button type="button" class="quiet" id="weeklyCollapse">Свернуть всё</button><span id="weeklyReportCount" role="status"></span></div><div id="weeklyFilterEmpty" class="empty" hidden>Нет отчётов по выбранным условиям.</div>`;}
function bindWeeklyBrowser(){
 $('weeklySearch').oninput=e=>{weeklyQuery=e.target.value;applyReportFilters();};$('weeklyChannel').onchange=e=>{weeklyChannel=e.target.value;applyReportFilters();};
 $('weeklyCollapse').onclick=()=>{for(const host of [$('weeklyContent'),$('weeklyArchive')].filter(Boolean))for(const report of host.querySelectorAll('.weekly-report[open]'))report.open=false;$('weeklySearch').focus({preventScroll:true});};
 applyReportFilters();bindReportMenus();
}
function reportMedia(p){return `${reportChannels[p.channel]?`<span class="badge report-channel">${reportChannels[p.channel]}</span>`:''}${reportScreenshots(p.attachments||[])}`;}
let reportViewerBound=false;
function bindReportViewer(){
 if(reportViewerBound)return;reportViewerBound=true;
 document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-report-screenshot]');if(!trigger)return;
  const gallery=trigger.closest('.report-screenshots');if(!gallery)return;
  event.preventDefault();
  const shots=[...gallery.querySelectorAll('[data-report-screenshot]')];
  openReportViewer(shots.map(b=>b.querySelector('img').src),shots.indexOf(trigger),trigger);
 });
}
function openReportViewer(urls,start,opener){
 let dialog=$('reportImageViewer');
 if(dialog?.open)return;
 if(dialog){dialog._cleanupReport?.();dialog.remove();}
 dialog=document.createElement('dialog');dialog.id='reportImageViewer';dialog.className='report-image-viewer';dialog.setAttribute('aria-labelledby','reportImageTitle');document.body.append(dialog);
 dialog.innerHTML=`<div class="report-image-heading"><h2 id="reportImageTitle">Скриншот</h2><button type="button" data-image-close aria-label="Закрыть просмотр скриншота" autofocus>✕</button></div><div class="report-image-stage"><img alt="" hidden><p class="report-image-status" role="status">Загружаем изображение…</p></div><div class="report-image-controls"><button type="button" data-image-prev aria-label="Предыдущий скриншот">←</button><span data-image-counter aria-live="polite"></span><button type="button" data-image-next aria-label="Следующий скриншот">→</button><button type="button" data-image-zoom aria-pressed="false">Увеличить</button></div>`;
 const img=dialog.querySelector('img'),stage=dialog.querySelector('.report-image-stage'),message=dialog.querySelector('.report-image-status'),zoom=dialog.querySelector('[data-image-zoom]');let index=start;
 const setZoom=value=>{stage.classList.toggle('is-zoomed',value);zoom.setAttribute('aria-pressed',String(value));zoom.textContent=value?'По размеру окна':'Увеличить';stage.scrollTo(0,0);};
 function showImage(){
  setZoom(false);img.hidden=true;zoom.disabled=true;message.hidden=false;message.textContent='Загружаем изображение…';
  dialog.querySelector('[data-image-counter]').textContent=`${index+1} / ${urls.length}`;
  dialog.querySelector('[data-image-prev]').disabled=index===0;dialog.querySelector('[data-image-next]').disabled=index===urls.length-1;
  img.onload=()=>{img.hidden=false;message.hidden=true;zoom.disabled=false;};
  img.onerror=()=>{img.hidden=true;message.hidden=false;message.textContent='Не удалось загрузить скриншот. Закройте просмотр и попробуйте снова.';};
  img.alt=`Скриншот ${index+1}`;img.src=urls[index];
 }
 const move=step=>{const next=index+step;if(next<0||next>=urls.length)return;const focused=document.activeElement;index=next;showImage();if(focused?.disabled)dialog.querySelector('[data-image-close]').focus();};
 dialog.querySelector('[data-image-prev]').onclick=()=>move(-1);dialog.querySelector('[data-image-next]').onclick=()=>move(1);
 zoom.onclick=()=>setZoom(!stage.classList.contains('is-zoomed'));img.onclick=()=>{if(!zoom.disabled)zoom.click();};
 const close=()=>{cleanup();dialog.close();};
 dialog.querySelector('[data-image-close]').onclick=close;
 let backdropDown=false;
 const outside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
 dialog.onpointerdown=e=>{backdropDown=e.target===dialog&&outside(e);};
 dialog.onclick=e=>{if(backdropDown&&e.target===dialog&&outside(e))close();backdropDown=false;};
 dialog.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}if(e.key==='Tab'){const buttons=[...dialog.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
 const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
 let cleaned=false;const cleanup=()=>{if(cleaned)return;cleaned=true;document.body.style.overflow=overflow;img.onload=null;img.onerror=null;img.removeAttribute('src');if(opener.isConnected)opener.focus({preventScroll:true});};
 dialog._cleanupReport=cleanup;dialog.onclose=cleanup;dialog.oncancel=()=>{cleanup();};
 dialog.showModal();showImage();
}
function reportScreenshots(ids,editable=false){bindReportViewer();return `<div class="report-screenshots">${ids.map((id,i)=>`<figure><button type="button" class="report-screenshot-open" data-report-screenshot="${h(id)}" aria-haspopup="dialog" aria-label="Открыть скриншот ${i+1} в полном размере"><img src="${api}/content/weekly-main/attachments/${h(id)}" alt="Скриншот ${i+1}" loading="lazy"></button><figcaption>Скриншот ${i+1}${editable?`<button type="button" class="quiet" data-remove-screenshot="${h(id)}" aria-label="Убрать скриншот ${i+1}">Убрать</button>`:' · Нажмите, чтобы увеличить'}</figcaption></figure>`).join('')}</div>`;}
function renderReportScreenshots(){
 $('reportScreenshots').innerHTML=reportScreenshots(state.weekly.attachments,true);
 $('reportScreenshots').onclick=e=>{const b=e.target.closest('[data-remove-screenshot]');if(!b||state.weekly.uploading||$('weeklyForm').dataset.busy)return;state.weekly.attachments=state.weekly.attachments.filter(id=>id!==b.dataset.removeScreenshot);state.dirty=true;renderReportScreenshots();$('weeklyMessage').textContent='Есть несохранённые изменения';};
}
async function uploadReportScreenshots(event){
 const input=event.target,w=state.weekly,form=$('weeklyForm'),files=[...input.files];if(!files.length||weeklyDeleting||w.uploading||form.dataset.busy)return;
 const msg=$('screenshotMessage');
 if(files.length+w.attachments.length>8){msg.textContent='В одном отчёте можно прикрепить до 8 скриншотов.';input.value='';return;}
 if(files.some(f=>!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>8*1024*1024)){msg.textContent='Выберите PNG, JPEG или WebP, не более 8 МБ каждый.';input.value='';return;}
 w.uploading=true;state.dirty=true;input.disabled=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);let uploaded=0;
 try{for(const file of files){msg.textContent=`Загружаем скриншот ${++uploaded} из ${files.length}…`;const result=await json(`${api}/content/weekly-main/attachments`,{method:'POST',headers:{'content-type':file.type},body:file});if(!w.attachments.includes(result.id))w.attachments.push(result.id);renderReportScreenshots();}msg.textContent='Скриншоты загружены. Сохраните или опубликуйте отчёт.';}
 catch(e){msg.textContent=explain(e);}
 finally{w.uploading=false;input.disabled=false;input.value='';form.querySelectorAll('button').forEach(b=>b.disabled=false);$('weeklyMessage').textContent='Есть несохранённые изменения';}
}
async function prepareReportUpload(){
 const input=$('reportScreenshotInput'),msg=$('screenshotMessage');
 try{const d=await json(`${api}/content/weekly-main/attachments`);input.disabled=!d.available;msg.textContent=d.available?'До 8 изображений, PNG / JPEG / WebP, до 8 МБ каждое.':'Прикрепление скриншотов ожидает подключения хранилища.';}
 catch(e){msg.textContent=explain(e);}
}
function summaryPayload(revision){return revision?.blocks?.find(b=>b.type==='period_summary')?.payload || {};}
let weeklyLoading=false,weeklyAttempt=null,weeklyLoadedAt=0,weeklyRange='',weeklyPending=null,weeklyEditing=false,weeklyOpening=false;
let weeklyReports=[],weeklyPermissions={canEdit:false,canDelete:false};
const weeklyPath=()=>'/content/'+state.weekly.key;
function loadWeekly(force=false){
  if(weeklyPending)return weeklyPending;
  weeklyPending=fetchWeekly(force).finally(()=>weeklyPending=null);return weeklyPending;
}
async function fetchWeekly(force=false){
  if(weeklyLoading || state.dirty&&!force)return;
  const selectedRange=JSON.stringify(state.range);if(!force&&weeklyRange===selectedRange&&Date.now()-weeklyLoadedAt<60000)return;
  weeklyLoading=true;if(!weeklyLoadedAt)$('weeklyContent').innerHTML=empty('Загружаем отчёты…');
  try{
    const collection=await json(`${api}/content/reports`);
    weeklyPermissions={canEdit:privateMode&&collection.canEdit,canDelete:collection.canDelete};
    weeklyReports=collection.reports.map(r=>({key:r.logicalKey,published:{publishedRevision:r.publishedRevision},history:r.item?{item:r.item,canDelete:collection.canDelete}:null,revision:r.latestRevision||r.publishedRevision}));
    if(weeklyEditing&&state.weekly){
      state.weekly=weeklyReports.find(r=>r.key===state.weekly.key)||(state.weekly.isNew?state.weekly:null);
      if(state.weekly)renderWeeklyEditor();else{weeklyEditing=false;renderWeeklySummary();}
    }else renderWeeklySummary();
    weeklyLoadedAt=Date.now();weeklyRange=selectedRange;if(force)archiveLoadedAt=0;
  }catch(e){$('weeklyContent').innerHTML=empty(explain(e))+'<button type="button" class="secondary" id="retryWeekly">Повторить</button>';$('retryWeekly').onclick=()=>loadWeekly(true);}
  finally{weeklyLoading=false;}
}
let archiveLoading=false,archiveLoadedAt=0,weeklyDeleting=false;
async function loadWeeklyArchive(){
 if(archiveLoading||Date.now()-archiveLoadedAt<60000)return;archiveLoading=true;
 try{const d=await json(`${api}/weekly-reports`);const canDelete=privateMode&&d.canDelete===true;
 const opened=new Set([...$('weeklyArchive').querySelectorAll('.weekly-report[open]')].map(r=>r.dataset.reportId));
 $('weeklyArchive').innerHTML=d.reports.length?'<h2 class="report-archive-title">Предыдущие отчёты</h2><div id="archiveDeleteMessage" class="message" role="status"></div>'+groupReportRows(d.reports.map(p=>({p,html:`<details class="campaign weekly-report" data-report-id="archive:${h(p.id)}" data-channel="${h(p.channel||'')}" ${opened.has('archive:'+p.id)?'open':''}><summary><span class="report-heading"><b class="report-channel">${h(reportChannels[p.channel]||'Отчёт')}</b><span class="report-expand" aria-hidden="true"></span></span>${reportSummary(p)}</summary><div class="children">${reportFields(p)}${canDelete?`<div class="actions">${reportMenu(`<button type="button" class="quiet report-delete" data-delete-imported="${h(p.id)}">Удалить отчёт</button>`)}</div>`:''}</div></details>`}))):'';
 bindReportMenus();applyReportFilters();
 $('weeklyArchive').querySelectorAll('[data-delete-imported]').forEach(b=>b.onclick=()=>deleteWeeklyReport(d.reports.find(p=>p.id===b.dataset.deleteImported),b));
 archiveLoadedAt=Date.now();}catch(e){$('weeklyArchive').innerHTML=empty(explain(e));}finally{archiveLoading=false;}
}
function weeklyDeleteButton(w=state.weekly){return privateMode&&w?.history?.canDelete===true&&w.history.item.latestRevision>0?`<button type="button" class="quiet report-delete" data-delete-weekly="${h(w.key)}">Удалить отчёт</button>`:'';}
function bindWeeklyDeletion(){$('weeklyContent').querySelectorAll('[data-delete-weekly]').forEach(b=>b.onclick=()=>{const w=weeklyReports.find(r=>r.key===b.dataset.deleteWeekly)||state.weekly;if(!weeklyEditing)state.weekly=w;deleteWeeklyReport(null,b);});}
async function deleteWeeklyReport(imported,button){
 if(weeklyDeleting||state.weekly?.uploading||$('weeklyForm')?.dataset.busy)return;
 const w=state.weekly,p=imported||summaryPayload(w?.revision);
 const extra=!imported&&w?.published?.publishedRevision&&w.revision?.revisionNumber!==w.published.publishedRevision.revisionNumber?' Опубликованная версия и текущий черновик будут убраны вместе.':'';
 if(!confirm(`Удалить отчёт за ${p.periodStart||'выбранный период'} — ${p.periodEnd||''}${reportChannels[p.channel]?' · '+reportChannels[p.channel]:''}? Он исчезнет из дашборда клиента.${extra}${!imported&&state.dirty?' Несохранённые изменения будут потеряны.':''}`))return;
 weeklyDeleting=true;button.disabled=true;const label=button.textContent;button.textContent='Удаляем…';
 try{
  const path=imported?'/weekly-reports/delete':weeklyPath()+'/delete';
  const body=imported?{id:imported.id,expectedUpdatedAt:imported.updatedAt}:{id:w.history.item.id,expectedRevision:w.history.item.latestRevision,expectedPublishedRevisionId:w.history.item.publishedRevisionId};
  await write(path,body);
  if(!imported){state.dirty=false;weeklyEditing=false;weeklyAttempt=null;state.weekly=null;await loadWeekly(true);}
  archiveLoadedAt=0;await loadWeeklyArchive();
  const msg=$('weeklyMessage');if(msg){msg.classList.remove('error');msg.textContent='Отчёт удалён.';}
 }catch(e){const msg=$(imported?'archiveDeleteMessage':'weeklyMessage');if(msg){msg.textContent=explain(e);msg.classList.add('error');}}
 finally{weeklyDeleting=false;if(button.isConnected){button.disabled=false;button.textContent=label;}}
}
function weeklyReportRow(w,revision,{draft=false,editable=false}={}){
 const p=summaryPayload(revision);
 return `<details class="campaign weekly-report" data-report-id="${h(w.key)}:${draft?'draft':'published'}" data-channel="${h(p.channel||'')}" data-report-key="${h(w.key)}" ${draft?'data-weekly-draft':'data-weekly-published'}><summary><span class="report-heading"><b class="report-channel">${h(reportChannels[p.channel]||'Отчёт')}</b>${draft?' <span class="badge report-draft">Черновик</span>':''}<span class="report-expand" aria-hidden="true"></span></span>${reportSummary(p)}</summary><div class="children">${reportFields(p)}${reportScreenshots(p.attachments||[])}${editable?`<div class="actions"><button type="button" class="secondary" data-edit-weekly="${h(w.key)}">${draft?'Продолжить редактирование':'Редактировать'}</button><button type="button" class="quiet" data-weekly-history="${h(w.key)}">История</button>${reportMenu(weeklyDeleteButton(w))}</div>`:''}</div></details>`;
}
function renderWeeklySummary(){
 const editor=weeklyPermissions.canEdit;
 const opened=new Set([...$('weeklyContent').querySelectorAll('.weekly-report[open]')].map(r=>r.dataset.reportId));
 const entries=weeklyReports.flatMap(w=>{const published=w.published.publishedRevision,draft=editor&&w.revision&&w.revision.revisionNumber!==published?.revisionNumber?w.revision:null;return [...(draft?[{p:summaryPayload(draft),html:weeklyReportRow(w,draft,{draft:true,editable:true})}]:[]),...(published?[{p:summaryPayload(published),html:weeklyReportRow(w,published,{editable:editor&&!draft})}]:[])];});
 $('weeklyContent').innerHTML=`<div id="weeklyMessage" class="message" role="status"></div>${weeklyBrowserTools()}${groupReportRows(entries)||empty('Опубликованных итогов пока нет.')}${editor&&!entries.length?'<button type="button" class="primary" data-new-weekly>Добавить итог</button>':''}`;
 for(const report of $('weeklyContent').querySelectorAll('.weekly-report'))if(opened.has(report.dataset.reportId))report.open=true;
 bindWeeklyBrowser();
 $('weeklyContent').querySelectorAll('[data-edit-weekly]').forEach(b=>b.onclick=()=>openWeeklyEditor(b.dataset.editWeekly));
 $('weeklyContent').querySelectorAll('[data-weekly-history]').forEach(b=>b.onclick=()=>openHistory(b.dataset.weeklyHistory));
 $('weeklyContent').querySelector('[data-new-weekly]')?.addEventListener('click',()=>openWeeklyEditor());bindWeeklyDeletion();
}
async function openWeeklyEditor(key=null){
 if(weeklyOpening||weeklyDeleting||!privateMode||window.TOYS_ACCESS_ROLE==='viewer'||state.weekly?.uploading||$('weeklyForm')?.dataset.busy)return;
 if(state.dirty&&!confirm('Закрыть текущий отчёт без сохранения изменений?'))return;
 weeklyOpening=true;
 try{
  state.dirty=false;await loadWeekly();
  if(!weeklyPermissions.canEdit)return;
  if(key){
   const w=weeklyReports.find(r=>r.key===key);if(!w)return;
   state.weekly=w;
  }else{
   state.weekly={key:'weekly-'+crypto.randomUUID(),isNew:true,published:{publishedRevision:null},history:{canDelete:weeklyPermissions.canDelete,item:{latestRevision:0,publishedRevisionId:null}},revision:null};
  }
  weeklyEditing=true;weeklyAttempt=null;commentAttempt=null;renderWeeklyEditor();
  $('weeklyContent')?.scrollIntoView({block:'start'});$('weeklyForm')?.querySelector('[name="summary"]')?.focus({preventScroll:true});
 }catch(e){$('weeklyMessage').textContent=explain(e);}finally{weeklyOpening=false;}
}
function renderWeeklyEditor(){
  const w=state.weekly,p=summaryPayload(w.revision),from=p.periodStart||state.range?.from||'',to=p.periodEnd||state.range?.to||'';
  w.attachments=[...(p.attachments||[])];
  $('weeklyContent').innerHTML=`<div class="panel-title"><span class="badge">${w.isNew?'Новый отчёт':w.revision?.status==='published'?'Опубликованная версия':'Черновик'} · ${w.history.item.latestRevision || 0}</span><button id="openHistory" class="quiet" type="button">История</button></div><form id="weeklyForm"><div class="form-grid" style="margin-top:20px"><label class="field full">Направление отчёта<select name="channel" required><option value="">Выберите направление</option>${Object.entries(reportChannels).map(([key,label])=>`<option value="${key}" ${p.channel===key?'selected':''}>${label}</option>`).join('')}</select></label><label class="field">Начало недели<input type="date" name="periodStart" value="${h(from)}" required></label><label class="field">Конец недели<input type="date" name="periodEnd" value="${h(to)}" required></label>${fields.map(([key,label])=>`<label class="field ${key==='summary'?'full':''}">${label}<textarea name="${key}" rows="${key==='summary'?3:4}" maxlength="8000" ${key==='summary'?'required':''}>${h(p[key] || '')}</textarea></label>`).join('')}</div><section class="report-attachments"><h3>Скриншоты</h3><div id="reportScreenshots"></div><label class="field">Прикрепить скриншоты<input id="reportScreenshotInput" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled></label><p id="screenshotMessage" class="note" role="status">Проверяем доступность загрузки…</p></section><div class="actions"><button class="secondary" type="submit" value="draft">Сохранить черновик</button><button class="primary" type="submit" value="publish">Сохранить и опубликовать</button><button class="quiet" type="button" id="reloadWeekly">Обновить отчёт</button><button class="quiet" type="button" id="closeWeeklyEditor">К списку отчётов</button>${weeklyDeleteButton()}</div><div id="weeklyMessage" class="message" role="status"></div></form><div class="comments"><h2>Комментарии команды</h2><div id="commentsList"></div><form id="commentForm"><label class="field">Новый комментарий<textarea name="body" maxlength="3000" required rows="2"></textarea></label><div class="actions"><button class="secondary">Добавить комментарий</button></div><div id="commentMessage" class="message" role="status"></div></form></div>`;
  $('weeklyForm').addEventListener('input',()=>{state.dirty=true;$('weeklyMessage').textContent='Есть несохранённые изменения';});
  renderReportScreenshots();$('reportScreenshotInput').onchange=uploadReportScreenshots;prepareReportUpload();
  $('weeklyForm').onsubmit=saveWeekly;bindWeeklyDeletion();
  $('closeWeeklyEditor').onclick=()=>{if(state.weekly.uploading||$('weeklyForm').dataset.busy)return;if(state.dirty&&!confirm('Закрыть форму без сохранения изменений?'))return;state.dirty=false;weeklyEditing=false;renderWeeklySummary();};
  $('reloadWeekly').onclick=()=>{if(!state.dirty || confirm('Заменить несохранённый текст версией с сервера?')){state.dirty=false;loadWeekly(true);}};
  $('openHistory').hidden=w.isNew;$('openHistory').onclick=()=>openHistory(w.key);
  $('commentForm').onsubmit=saveComment;$('commentForm').closest('.comments').hidden=w.isNew;if(!w.isNew)loadComments();
}
async function saveWeekly(event){
  event.preventDefault();const form=event.currentTarget;if(weeklyDeleting||form.dataset.busy||state.weekly.uploading)return;
  const values={...Object.fromEntries(new FormData(form)),attachments:[...state.weekly.attachments]};if(!validRange(values.periodStart,values.periodEnd)){ $('weeklyMessage').textContent='Проверьте даты отчёта.';return; }
  const publish=event.submitter?.value==='publish';const w=state.weekly;
  // Preserve non-summary blocks when editing an existing report.
  const others=(w.revision?.blocks || []).filter(b=>b.type!=='period_summary').map(({type,blockKey,payload})=>({type,blockKey,payload}));
  const body={expectedRevision:w.history.item.latestRevision,expectedPublishedRevisionId:w.history.item.publishedRevisionId,reason:publish?'Публикация недельного отчёта':'Сохранение черновика',blocks:[{type:'period_summary',blockKey:'summary',payload:values},...others]};
  const path=`${weeklyPath()}/${publish?'save-and-publish':'revisions'}`;const encoded=JSON.stringify({path,body});
  if(weeklyAttempt?.encoded!==encoded)weeklyAttempt={encoded,key:crypto.randomUUID()};
  form.dataset.busy='true';form.querySelectorAll('button').forEach(b=>b.disabled=true);$('weeklyMessage').textContent='Сохраняем…';
  try{if(w.isNew){const created=await write(weeklyPath()+'/initialize',{});w.history.item=created.item;w.isNew=false;}const saved=await write(path,body,weeklyAttempt.key);const detail=await json(`${api}${weeklyPath()}/revisions/${saved.revision.id}`);
    if(JSON.stringify(summaryPayload(detail.revision))!==JSON.stringify(values))throw new Error('Проверка сохранённого текста не пройдена');
    if(publish){const publicView=await json(`${api}/content?logicalKey=${w.key}`),revision=publicView.publishedRevision;if(!revision||revision.revisionNumber!==saved.revision.revisionNumber||JSON.stringify(summaryPayload(revision))!==JSON.stringify(values))throw new Error('Публикация пока не подтверждена');}
    state.dirty=false;weeklyAttempt=null;if(publish)weeklyEditing=false;await loadWeekly(true);$('weeklyMessage').textContent=publish?'Отчёт опубликован. Сохранённая версия проверена.':'Черновик сохранён. Публичный отчёт не изменён.';
  }catch(e){$('weeklyMessage').textContent=explain(e);$('weeklyMessage').classList.add('error');}
  finally{delete form.dataset.busy;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
async function openHistory(key=state.weekly?.key){if(!key)return;const reportPath='/content/'+key;const dialog=$('history');$('historyContent').innerHTML=empty('Загружаем историю…');dialog.showModal();try{const history=await json(`${api}${reportPath}/revisions`);$('historyContent').innerHTML=history.revisions.length?history.revisions.map(r=>`<div class="comment"><b>Версия ${r.revisionNumber}</b> · ${h(r.status==='published'?'Опубликована':'Черновик')}<p>${h(r.reason || '')}</p><small>${h(r.createdAt)}</small><div class="actions"><button class="secondary" data-revision="${h(r.id)}">Посмотреть</button>${r.id!==history.item.publishedRevisionId?`<button class="quiet" data-rollback="${h(r.id)}">Восстановить и опубликовать</button>`:''}</div><div id="revision-${h(r.id)}"></div></div>`).join(''):empty('Сохранённых версий пока нет.');
    $('historyContent').onclick=async e=>{const view=e.target.closest('[data-revision]'),rollback=e.target.closest('[data-rollback]');if(view){try{const d=await json(`${api}${reportPath}/revisions/${view.dataset.revision}`);const p=summaryPayload(d.revision);$('revision-'+view.dataset.revision).innerHTML=reportMedia(p)+reportFields(p,{includeSummary:true});}catch(err){status(explain(err),true);}}if(rollback && confirm('Восстановить выбранную версию и опубликовать её?')){rollback.disabled=true;try{await write(`${reportPath}/revisions/${rollback.dataset.rollback}/rollback`,{expectedRevision:history.item.latestRevision,expectedPublishedRevisionId:history.item.publishedRevisionId});state.dirty=false;weeklyEditing=false;dialog.close();await loadWeekly(true);}catch(err){status(explain(err),true);rollback.disabled=false;}}};
  }catch(e){$('historyContent').innerHTML=empty(explain(e));}}
async function loadComments(){const target=$('commentsList'),path=weeklyPath();try{const d=await json(`${api}${path}/comments?order=chronological`);if(!target.isConnected||target!==$('commentsList'))return;target.innerHTML=d.comments.length?d.comments.map(c=>`<div class="comment">${h(c.body)}<small>${h(c.createdAt)}</small></div>`).join(''):empty('Комментариев пока нет.');}catch(e){if(target.isConnected&&target===$('commentsList'))target.innerHTML=empty(explain(e));}}
let commentAttempt=null;
async function saveComment(e){e.preventDefault();const f=e.currentTarget,b=f.querySelector('button');if(b.disabled)return;const body=String(new FormData(f).get('body') || '').trim();if(!body)return;if(commentAttempt?.body!==body)commentAttempt={body,key:crypto.randomUUID()};b.disabled=true;try{await write(weeklyPath()+'/comments',{body},commentAttempt.key);commentAttempt=null;f.reset();await loadComments();$('commentMessage').textContent='Комментарий сохранён.';}catch(err){$('commentMessage').textContent=explain(err);}finally{b.disabled=false;}}

let projectLoading=false,tabSequence=0;
async function loadProject(){if(state.tabs){renderProjectNav();return;}if(projectLoading)return;projectLoading=true;$('projectContent').innerHTML=empty('Загружаем материалы…');try{const d=await json(`${api}/content/tabs`);state.tabs=d.tabs || [];state.channel=state.tabs[0]?.channel;renderProjectNav();}catch(e){$('projectContent').innerHTML=empty(explain(e));}finally{projectLoading=false;}}
function renderProjectNav(){const tabs=state.tabs || [];if(!tabs.length){$('projectContent').innerHTML=empty('Материалы проекта пока не добавлены.');return;}
  const channels=[...new Set(tabs.map(t=>t.channel || 'project'))];
  $('projectChannels').innerHTML=channels.map(c=>`<button type="button" data-channel="${h(c)}" class="${c===(state.channel||'project')?'active':''}">${h(({meta:'Meta',google:'Google',smm:'SMM',project:'Проект'})[c] || c)}</button>`).join('');
  $('projectChannels').onclick=e=>{const b=e.target.closest('[data-channel]');if(b){state.channel=b.dataset.channel;state.tab=null;renderProjectNav();}};
  const filtered=tabs.filter(t=>(t.channel||'project')===(state.channel||'project'));if(!filtered.some(t=>t.sourceTitle===state.tab))state.tab=filtered[0]?.sourceTitle;
  $('projectTabs').innerHTML=filtered.map(t=>`<button type="button" data-tab="${h(t.sourceTitle)}" class="${t.sourceTitle===state.tab?'active':''}">${h(t.label || t.sourceTitle)}</button>`).join('');
  $('projectTabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(b){state.tab=b.dataset.tab;renderProjectNav();}};loadTab(state.tab);
}
function cellText(cell){const v=cell?.f ?? cell?.v ?? '';return typeof v==='object'?JSON.stringify(v):String(v);}
function cellHtml(cell){const text=cellText(cell);if(/^https?:\/\/\S+$/.test(text)){try{const u=new URL(text);if(['https:','http:'].includes(u.protocol))return `<a href="${h(u.href)}" target="_blank" rel="noopener noreferrer">${h(text)}</a>`;}catch{}}return h(text);}
async function loadTab(title){if(!title)return;const seq=++tabSequence;$('projectContent').innerHTML=empty('Загружаем материал…');try{const d=await json(`${api}/content/tabs?tab=${encodeURIComponent(title)}`);if(seq!==tabSequence)return;const table=d.table || {},rows=table.rows || [],cols=table.cols || [];$('projectContent').innerHTML=`<h2>${h(title)}</h2>`+(rows.length?`<div class="table-scroll"><table><thead><tr>${cols.map(c=>`<th>${h(c.label || '')}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${(r.c || []).map(c=>`<td>${cellHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty('Этот материал пока не заполнен.'));}catch(e){if(seq===tabSequence)$('projectContent').innerHTML=empty(explain(e));}}

const creativeStatuses={draft:'Черновик',in_review:'На согласовании',approved:'Согласован',rejected:'Нужны изменения',archived:'В архиве'};
const creativeTransitions={draft:['in_review','archived'],in_review:['draft','approved','rejected','archived'],approved:['archived'],rejected:['draft','in_review','archived'],archived:[]};
let creativeLoading=false,creativeMaxBytes=50*1024*1024,creativeLoadedAt=0;
async function loadCreatives(force=false){if(creativeLoading||!force&&Date.now()-creativeLoadedAt<60000)return;creativeLoading=true;if(!creativeLoadedAt)$('creativeContent').innerHTML=empty('Загружаем креативы…');try{const d=await json(`${api}/content-project/creatives`);const editor=d.access?.role==='editor';const available=editor&&(d.storage?.available === true || d.upload?.available === true);creativeMaxBytes=d.storage?.maxObjectBytes || 50*1024*1024;
  $('creativeContent').innerHTML=`<div class="panel"><div class="panel-title"><h2>Файлы проекта</h2>${available?'<label class="primary">Загрузить<input id="uploadFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" hidden></label>':editor?'<span class="note">Загрузка файлов ожидает подключения хранилища</span>':'<span class="note">Согласование креативов</span>'}</div><div id="uploadMessage" class="message" role="status"></div></div><div class="creative-grid">${(d.creatives||[]).map(c=>`<article class="panel creative-card" data-creative="${h(c.id)}">${c.uploadState==='ready'? c.kind==='video'?`<video class="creative-media" controls preload="metadata" src="${api}/content-project/creatives/${h(c.id)}/preview"></video>`:`<img class="creative-media" loading="lazy" alt="${h(c.fileName)}" src="${api}/content-project/creatives/${h(c.id)}/preview">`:empty('Файл ещё не загружен')}<h3>${h(c.fileName)}</h3><span class="badge">${h(creativeStatuses[c.status]||c.status)}</span><p>${h(c.reviewReason||'')}</p>${c.status==='in_review'?'<textarea class="review-reason" placeholder="Комментарий или необходимые изменения" aria-label="Комментарий к согласованию"></textarea>':''}<div class="actions">${(editor?(creativeTransitions[c.status]||[]):c.status==='in_review'?['approved','rejected']:[]).map(to=>`<button type="button" class="secondary" data-status="${h(to)}" data-id="${h(c.id)}" data-expected="${h(c.status)}" data-version="${c.statusVersion}">${h(creativeStatuses[to])}</button>`).join('')}<button type="button" class="quiet" data-comments="${h(c.id)}">Комментарии</button></div><div id="creative-comments-${h(c.id)}"></div></article>`).join('') || empty('Креативов пока нет.')}</div>`;
  $('uploadFile')?.addEventListener('change',uploadCreative);$('creativeContent').onclick=async e=>{const b=e.target.closest('[data-comments]');if(b)creativeComments(b.dataset.comments);const action=e.target.closest('[data-status]');if(action&&!action.disabled){action.disabled=true;try{await write(`/content-project/creatives/${action.dataset.id}`,{status:action.dataset.status,expectedStatus:action.dataset.expected,expectedVersion:Number(action.dataset.version),...(action.closest('.creative-card').querySelector('.review-reason')?.value.trim()?{reason:action.closest('.creative-card').querySelector('.review-reason').value.trim()}:{})},crypto.randomUUID(),'PATCH');await loadCreatives(true);}catch(err){$('uploadMessage').textContent=explain(err);action.disabled=false;}}};
creativeLoadedAt=Date.now();
}catch(e){$('creativeContent').innerHTML=!privateMode?`<p>Загрузка и согласование креативов доступны после входа в личный кабинет.</p><a class="primary" href="${api}/content-project#meta">Войти в личный кабинет</a>`:empty(explain(e));}finally{creativeLoading=false;}}
async function uploadCreative(e){const file=e.target.files?.[0];if(!file)return;const msg=$('uploadMessage');if(file.size>creativeMaxBytes){msg.textContent=`Максимальный размер файла — ${number(creativeMaxBytes/1024/1024)} МБ.`;return;}e.target.disabled=true;msg.textContent='Загружаем файл…';try{const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');const d=await write('/content-project/creatives',{fileName:file.name,mediaType:file.type,byteSize:file.size,sha256:hash});if(!d.upload?.available)throw new Error(d.upload?.reason || 'object_storage_binding_missing');const r=await fetch(`${api}/content-project/creatives/${d.creative.id}/upload`,{method:'PUT',headers:{'content-type':file.type},body:file});const result=await r.json();if(!r.ok||!result.ok)throw new Error(result.error || 'Ошибка загрузки');await loadCreatives(true);$('uploadMessage').textContent='Файл загружен.';}catch(err){msg.textContent=explain(err);}finally{e.target.disabled=false;}}
async function creativeComments(id){const target=$('creative-comments-'+id);target.innerHTML=empty('Загружаем комментарии…');try{const d=await json(`${api}/content-project/creatives/${id}/comments`);target.innerHTML=(d.comments||[]).map(c=>`<div class="comment">${h(c.body)}<small>${h(c.createdAt)}</small></div>`).join('')+`<form class="comments"><label class="field">Комментарий<textarea name="body" required maxlength="3000" rows="2"></textarea></label><div class="actions"><button class="secondary">Отправить</button></div><div class="message" role="status"></div></form>`;const f=target.querySelector('form');let attempt=null;f.onsubmit=async e=>{e.preventDefault();const button=f.querySelector('button');if(button.disabled)return;const body=String(new FormData(f).get('body')||'').trim();if(!body)return;if(attempt?.body!==body)attempt={body,key:crypto.randomUUID()};button.disabled=true;try{await write(`/content-project/creatives/${id}/comments`,{body},attempt.key);await creativeComments(id);}catch(err){f.querySelector('.message').textContent=explain(err);button.disabled=false;}};}catch(e){target.innerHTML=empty(explain(e));}}

$('projectName').textContent=names[slug] || 'Проект';document.title=`TOYS × ${names[slug] || 'Проект'} — Дашборд`;
$('accessLabel').textContent=privateMode?'Рабочий дашборд':'Опубликованный отчёт';$('creativeNav').hidden=!privateMode;$('ownerLink').hidden=privateMode;$('ownerLink').href=`${api}/content-project`;
document.querySelector('.nav').onclick=e=>{const b=e.target.closest('[data-view]');if(b){location.hash=b.dataset.view;show(b.dataset.view);}};
window.addEventListener('hashchange',()=>show(location.hash.slice(1)));
document.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{preset(Number(b.dataset.days));load();});
$('periodForm').onsubmit=e=>{e.preventDefault();updatePresets(0);load();};$('refresh').onclick=()=>load(true);
document.querySelectorAll('.dates input').forEach(input=>input.onchange=()=>updatePresets(0));
$('history').querySelector('[data-close]').onclick=()=>$('history').close();
try{document.documentElement.dataset.theme=localStorage.getItem('toys-unified-theme') || 'dark';}catch{}
$('theme').onclick=()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('toys-unified-theme',theme);}catch{}};
window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue='';}});
preset(7);show(location.hash.slice(1) || (location.pathname.endsWith('/content-editor')?'weekly':'overview'));load();
