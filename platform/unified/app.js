import {escapeHtml as h, dateShift, validRange, advertisingModel, aggregate, campaignGroups, nodeTotals, businessMetrics, total} from './model.js';

const $ = id => document.getElementById(id);
const prefix = location.pathname.startsWith('/mvp/') ? '/mvp' : '';
const slug = window.TOYS_UNIFIED_PROJECT || location.pathname.match(/projects\/([^/]+)/)?.[1] || location.pathname.split('/').filter(Boolean).filter(s => s !== 'mvp')[0];
const api = `${prefix}/api/v2/projects/${slug}`;
const privateMode = window.TOYS_MVP_PROJECT_PORTAL === true;
const names = {'housevip-cxp7':'HOUSEVIP','profkit-instashop-r4vk':'PROFKIT INSTASHOP','karlovarska-sul-k4rm':'KARLOVARSKA SUL'};
const state = {view:'overview',dashboard:null,ads:null,range:null,rows:[],sequence:0,weekly:null,dirty:false,tabs:null,channel:null,tab:null};
const nf = new Intl.NumberFormat('ru-RU', {maximumFractionDigits:2});
const number = n => n == null ? '—' : nf.format(n);
const money = (n,c) => n == null ? '—' : `${number(n)} ${c || ''}`.trim();
const status = (message, error = false) => { $('status').textContent = message; $('status').classList.toggle('error',error); };
const empty = text => `<div class="empty">${h(text)}</div>`;
const errors = {revision_conflict:'Отчёт изменился в другой вкладке. Ваш текст сохранён на экране. Обновите историю перед повторным сохранением.',publication_conflict:'Опубликованная версия изменилась. Обновите историю отчёта.',provider_unauthorized:'Рекламный кабинет отклонил доступ.',provider_rate_limited:'Рекламный кабинет ограничил частоту запросов. Повторите позже.',refresh_rate_limited:'Обновление уже выполнялось недавно. Повторите через несколько секунд.',provider_adapter_unavailable:'Прямое подключение этого рекламного источника ещё не завершено.',active_ads_integration_missing:'Рекламный источник не подключён.',storage_quota_not_configured:'Лимит файлового хранилища ещё не настроен.',object_storage_binding_missing:'Файловое хранилище ещё не подключено.',invalid_date_range:'Выберите период не более 90 дней.',no_published_release:'У проекта пока нет опубликованных данных.',not_found:'Данные пока не созданы.'};
function explain(error) { return errors[error?.message || error] || (error?.status === 401 || error?.status === 403 ? 'Для этого действия войдите в проект.' : `Не удалось выполнить действие${error?.message ? `: ${error.message}` : ''}. Повторите попытку.`); }
async function json(url, options = {}) {
  const response = await fetch(url, {...options, credentials:'same-origin', cache:'no-store', headers:{...(options.body ? {'content-type':'application/json'} : {}), ...options.headers}});
  const body = await response.json().catch(() => null);
  if (!response.ok || !(body?.ok || body?.status==='ok' && body?.table)) {const error = new Error(body?.error || (response.redirected || /text\/html/.test(response.headers.get('content-type') || '') ? 'Требуется повторный вход' : `HTTP ${response.status}`));error.status=response.redirected ? 401 : response.status;throw error;}
  return body;
}
const write = (path, body, key = crypto.randomUUID(), method = 'POST') => json(api + path, {method, headers:{'x-idempotency-key':key},body:JSON.stringify(body)});
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
function summaryPayload(revision){return revision?.blocks?.find(b=>b.type==='period_summary')?.payload || {};}
let weeklyLoading=false,weeklyAttempt=null;
async function loadWeekly(force=false){
  if(weeklyLoading || state.dirty&&!force)return;
  weeklyLoading=true;$('weeklyContent').innerHTML=empty('Загружаем отчёт…');
  try{
    const published=await json(`${api}/content?logicalKey=weekly-main`);
    if(privateMode){const history=await json(`${api}/content/weekly-main/revisions`);let revision=published.publishedRevision;
      if(history.revisions[0])revision=(await json(`${api}/content/weekly-main/revisions/${history.revisions[0].id}`)).revision;
      state.weekly={published,history,revision};renderWeeklyEditor();
    }else{state.weekly={published};const p=summaryPayload(published.publishedRevision);$('weeklyContent').innerHTML=published.publishedRevision ? `<span class="badge">Опубликовано</span><h2 style="margin-top:16px">${h(p.periodStart || '')} — ${h(p.periodEnd || '')}</h2>${fields.map(([key,label])=>`<div class="report-field"><h3>${label}</h3><p>${h(p[key] || '—')}</p></div>`).join('')}`:empty('Недельный отчёт ещё не опубликован.');}
  }catch(e){$('weeklyContent').innerHTML=empty(explain(e))+'<button type="button" class="secondary" id="retryWeekly">Повторить</button>';$('retryWeekly').onclick=()=>loadWeekly(true);}
  finally{weeklyLoading=false;}
}
let archiveLoading=false;
async function loadWeeklyArchive(){if(archiveLoading)return;archiveLoading=true;try{const d=await json(`${api}/weekly-reports`);$('weeklyArchive').innerHTML=d.reports.length?'<h2>Предыдущие отчёты</h2>'+d.reports.map(p=>`<details class="campaign"><summary><b>${h(p.periodStart)} — ${h(p.periodEnd)}</b><p>${h(p.summary || '')}</p></summary><div class="children">${fields.filter(([key])=>key!=='summary').map(([key,label])=>`<div class="report-field"><h3>${label}</h3><p>${h(p[key] || '—')}</p></div>`).join('')}</div></details>`).join(''):'';}catch(e){$('weeklyArchive').innerHTML=empty(explain(e));}finally{archiveLoading=false;}}
function renderWeeklyEditor(){
  const w=state.weekly,p=summaryPayload(w.revision),from=p.periodStart||state.range?.from||'',to=p.periodEnd||state.range?.to||'';
  $('weeklyContent').innerHTML=`<div class="panel-title"><span class="badge">${w.revision?.status==='published'?'Опубликованная версия':'Черновик'} · ${w.history.item.latestRevision || 0}</span><button id="openHistory" class="quiet" type="button">История</button></div><form id="weeklyForm"><div class="form-grid" style="margin-top:20px"><label class="field">Начало недели<input type="date" name="periodStart" value="${h(from)}" required></label><label class="field">Конец недели<input type="date" name="periodEnd" value="${h(to)}" required></label>${fields.map(([key,label])=>`<label class="field ${key==='summary'?'full':''}">${label}<textarea name="${key}" rows="${key==='summary'?3:4}" maxlength="8000" ${key==='summary'?'required':''}>${h(p[key] || '')}</textarea></label>`).join('')}</div><div class="actions"><button class="secondary" type="submit" value="draft">Сохранить черновик</button><button class="primary" type="submit" value="publish">Сохранить и опубликовать</button><button class="quiet" type="button" id="reloadWeekly">Обновить отчёт</button></div><div id="weeklyMessage" class="message" role="status"></div></form><div class="comments"><h2>Комментарии команды</h2><div id="commentsList"></div><form id="commentForm"><label class="field">Новый комментарий<textarea name="body" maxlength="3000" required rows="2"></textarea></label><div class="actions"><button class="secondary">Добавить комментарий</button></div><div id="commentMessage" class="message" role="status"></div></form></div>`;
  $('weeklyForm').addEventListener('input',()=>{state.dirty=true;$('weeklyMessage').textContent='Есть несохранённые изменения';});
  $('weeklyForm').onsubmit=saveWeekly;
  $('reloadWeekly').onclick=()=>{if(!state.dirty || confirm('Заменить несохранённый текст версией с сервера?')){state.dirty=false;loadWeekly(true);}};
  $('openHistory').onclick=openHistory;
  $('commentForm').onsubmit=saveComment;loadComments();
}
async function saveWeekly(event){
  event.preventDefault();const form=event.currentTarget;if(form.dataset.busy)return;
  const values=Object.fromEntries(new FormData(form));if(!validRange(values.periodStart,values.periodEnd)){ $('weeklyMessage').textContent='Проверьте даты отчёта.';return; }
  const publish=event.submitter?.value==='publish';const w=state.weekly;
  // Preserve non-summary blocks when editing an existing report.
  const others=(w.revision?.blocks || []).filter(b=>b.type!=='period_summary').map(({type,blockKey,payload})=>({type,blockKey,payload}));
  const body={expectedRevision:w.history.item.latestRevision,expectedPublishedRevisionId:w.history.item.publishedRevisionId,reason:publish?'Публикация недельного отчёта':'Сохранение черновика',blocks:[{type:'period_summary',blockKey:'summary',payload:values},...others]};
  const path=`/content/weekly-main/${publish?'save-and-publish':'revisions'}`;const encoded=JSON.stringify({path,body});
  if(weeklyAttempt?.encoded!==encoded)weeklyAttempt={encoded,key:crypto.randomUUID()};
  form.dataset.busy='true';form.querySelectorAll('button').forEach(b=>b.disabled=true);$('weeklyMessage').textContent='Сохраняем…';
  try{const saved=await write(path,body,weeklyAttempt.key);const detail=await json(`${api}/content/weekly-main/revisions/${saved.revision.id}`);
    if(JSON.stringify(summaryPayload(detail.revision))!==JSON.stringify(values))throw new Error('Проверка сохранённого текста не пройдена');
    if(publish){const publicView=await json(`${api}/content?logicalKey=weekly-main`);if(publicView.publishedRevision?.id!==saved.revision.id)throw new Error('Публикация пока не подтверждена');}
    state.dirty=false;weeklyAttempt=null;await loadWeekly(true);$('weeklyMessage').textContent=publish?'Отчёт опубликован. Сохранённая версия проверена.':'Черновик сохранён. Публичный отчёт не изменён.';
  }catch(e){$('weeklyMessage').textContent=explain(e);$('weeklyMessage').classList.add('error');}
  finally{delete form.dataset.busy;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
async function openHistory(){const dialog=$('history');$('historyContent').innerHTML=empty('Загружаем историю…');dialog.showModal();try{const history=await json(`${api}/content/weekly-main/revisions`);$('historyContent').innerHTML=history.revisions.length?history.revisions.map(r=>`<div class="comment"><b>Версия ${r.revisionNumber}</b> · ${h(r.status==='published'?'Опубликована':'Черновик')}<p>${h(r.reason || '')}</p><small>${h(r.createdAt)}</small><div class="actions"><button class="secondary" data-revision="${h(r.id)}">Посмотреть</button>${r.id!==history.item.publishedRevisionId?`<button class="quiet" data-rollback="${h(r.id)}">Восстановить и опубликовать</button>`:''}</div><div id="revision-${h(r.id)}"></div></div>`).join(''):empty('Сохранённых версий пока нет.');
    $('historyContent').onclick=async e=>{const view=e.target.closest('[data-revision]'),rollback=e.target.closest('[data-rollback]');if(view){try{const d=await json(`${api}/content/weekly-main/revisions/${view.dataset.revision}`);const p=summaryPayload(d.revision);$('revision-'+view.dataset.revision).innerHTML=fields.map(([k,l])=>`<div class="report-field"><b>${l}</b><p>${h(p[k] || '—')}</p></div>`).join('');}catch(err){status(explain(err),true);}}if(rollback && confirm('Восстановить выбранную версию и опубликовать её?')){rollback.disabled=true;try{await write(`/content/weekly-main/revisions/${rollback.dataset.rollback}/rollback`,{expectedRevision:history.item.latestRevision,expectedPublishedRevisionId:history.item.publishedRevisionId});state.dirty=false;dialog.close();await loadWeekly(true);}catch(err){status(explain(err),true);rollback.disabled=false;}}};
  }catch(e){$('historyContent').innerHTML=empty(explain(e));}}
async function loadComments(){try{const d=await json(`${api}/content/weekly-main/comments?order=chronological`);$('commentsList').innerHTML=d.comments.length?d.comments.map(c=>`<div class="comment">${h(c.body)}<small>${h(c.createdAt)}</small></div>`).join(''):empty('Комментариев пока нет.');}catch(e){$('commentsList').innerHTML=empty(explain(e));}}
let commentAttempt=null;
async function saveComment(e){e.preventDefault();const f=e.currentTarget,b=f.querySelector('button');if(b.disabled)return;const body=String(new FormData(f).get('body') || '').trim();if(!body)return;if(commentAttempt?.body!==body)commentAttempt={body,key:crypto.randomUUID()};b.disabled=true;try{await write('/content/weekly-main/comments',{body},commentAttempt.key);commentAttempt=null;f.reset();await loadComments();$('commentMessage').textContent='Комментарий сохранён.';}catch(err){$('commentMessage').textContent=explain(err);}finally{b.disabled=false;}}

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
let creativeLoading=false,creativeMaxBytes=50*1024*1024;
async function loadCreatives(){if(!privateMode || creativeLoading)return;creativeLoading=true;$('creativeContent').innerHTML=empty('Загружаем креативы…');try{const d=await json(`${api}/content-project/creatives`);const available=d.storage?.available === true || d.upload?.available === true;creativeMaxBytes=d.storage?.maxObjectBytes || 50*1024*1024;
  $('creativeContent').innerHTML=`<div class="panel"><div class="panel-title"><h2>Файлы проекта</h2>${available?'<label class="primary">Загрузить<input id="uploadFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" hidden></label>':'<span class="note">Загрузка файлов ожидает подключения хранилища</span>'}</div><div id="uploadMessage" class="message" role="status"></div></div><div class="creative-grid">${(d.creatives||[]).map(c=>`<article class="panel creative-card" data-creative="${h(c.id)}">${c.uploadState==='ready'? c.kind==='video'?`<video class="creative-media" controls preload="metadata" src="${api}/content-project/creatives/${h(c.id)}/preview"></video>`:`<img class="creative-media" loading="lazy" alt="${h(c.fileName)}" src="${api}/content-project/creatives/${h(c.id)}/preview">`:empty('Файл ещё не загружен')}<h3>${h(c.fileName)}</h3><span class="badge">${h(creativeStatuses[c.status]||c.status)}</span><div class="actions">${(creativeTransitions[c.status]||[]).map(to=>`<button type="button" class="secondary" data-status="${h(to)}" data-id="${h(c.id)}" data-expected="${h(c.status)}">${h(creativeStatuses[to])}</button>`).join('')}<button type="button" class="quiet" data-comments="${h(c.id)}">Комментарии</button></div><div id="creative-comments-${h(c.id)}"></div></article>`).join('') || empty('Креативов пока нет.')}</div>`;
  $('uploadFile')?.addEventListener('change',uploadCreative);$('creativeContent').onclick=async e=>{const b=e.target.closest('[data-comments]');if(b)creativeComments(b.dataset.comments);const action=e.target.closest('[data-status]');if(action&&!action.disabled){action.disabled=true;try{await write(`/content-project/creatives/${action.dataset.id}`,{status:action.dataset.status,expectedStatus:action.dataset.expected},crypto.randomUUID(),'PATCH');await loadCreatives();}catch(err){$('uploadMessage').textContent=explain(err);action.disabled=false;}}};
}catch(e){$('creativeContent').innerHTML=empty(explain(e));}finally{creativeLoading=false;}}
async function uploadCreative(e){const file=e.target.files?.[0];if(!file)return;const msg=$('uploadMessage');if(file.size>creativeMaxBytes){msg.textContent=`Максимальный размер файла — ${number(creativeMaxBytes/1024/1024)} МБ.`;return;}e.target.disabled=true;msg.textContent='Загружаем файл…';try{const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');const d=await write('/content-project/creatives',{fileName:file.name,mediaType:file.type,byteSize:file.size,sha256:hash});if(!d.upload?.available)throw new Error(d.upload?.reason || 'object_storage_binding_missing');const r=await fetch(`${api}/content-project/creatives/${d.creative.id}/upload`,{method:'PUT',headers:{'content-type':file.type},body:file});const result=await r.json();if(!r.ok||!result.ok)throw new Error(result.error || 'Ошибка загрузки');await loadCreatives();$('uploadMessage').textContent='Файл загружен.';}catch(err){msg.textContent=explain(err);}finally{e.target.disabled=false;}}
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
