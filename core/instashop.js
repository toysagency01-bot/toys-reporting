(function(){
const C = window.INSTASHOP_CONFIG || {};
const SHEET_ID = C.sheetId;
const M = window.InstashopModel;
const el = id => document.getElementById(id);
const fmt0 = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:0}).format(value || 0);
const fmt1 = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:1}).format(value || 0);
const money = value => `${fmt0(value)} ₴`;
const pct = value => value == null ? '—' : `${(value * 100).toFixed(1)}%`;
const ratio = value => value == null ? '—' : `${value.toFixed(2)}×`;
const WEEKLY_ACCESS_SHA256 = '0d48224e8240072cada34bddc9d80271a707827876f069132aa95055f8c93d64';
const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const lines = value => esc(value).replace(/\n/g, '<br>');

let META = [];
let SALES = [];
let COMMENTS = [];
let period = 7;
let chart = null;
let weeklySubmitPending = false;
let weeklySubmitTimer = null;

document.head.insertAdjacentHTML('beforeend', `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a0a0a;--panel:#121215;--panel2:#18181c;--line:rgba(255,255,255,.08);--text:#f3f3f5;--muted:#888891;--accent:#25ddcc;--violet:#8f7bff;--amber:#ffb454;--red:#ff6b81;--radius:14px}
*{box-sizing:border-box;margin:0;padding:0}html{background:var(--bg)}body{background:var(--bg);color:var(--text);font-family:'Golos Text',system-ui,sans-serif;min-height:100vh;padding:28px clamp(16px,4vw,48px) 64px}
header{display:flex;align-items:center;gap:14px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:22px;margin-bottom:22px}.brand{display:flex;align-items:center;gap:10px}.brand img{height:26px;width:auto}.sep{color:var(--muted)}.project{color:var(--muted);font-size:13px}.updated{margin-left:auto;color:var(--muted);font-size:12px}
.controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:22px}.seg{display:flex;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}.seg button{background:none;border:0;color:var(--muted);font:600 14px 'Golos Text';padding:10px 16px;cursor:pointer}.seg button.active{background:rgba(37,221,204,.12);color:var(--accent)}.range{display:flex;align-items:center;gap:6px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:4px 6px}.range input{background:none;border:0;color:var(--text);color-scheme:dark;font:500 13px 'Golos Text';padding:6px 8px;min-width:108px}.weekly-open{margin-left:auto;border:1px solid rgba(37,221,204,.45);background:rgba(37,221,204,.12);color:var(--accent);border-radius:10px;padding:10px 15px;font:600 13px 'Golos Text';cursor:pointer}.weekly-open:hover{background:rgba(37,221,204,.2)}
.state{padding:60px 20px;text-align:center;color:var(--muted);line-height:1.7}.state b{color:var(--text)}.hidden{display:none!important}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:12px;margin-bottom:22px}.card,.panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius)}.card{padding:18px}.label{color:var(--muted);font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:9px}.value{font-size:clamp(19px,2vw,27px);font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}.value small{display:block;color:var(--muted);font-size:11px;font-weight:500;margin-top:4px;white-space:normal}.panel{padding:20px;margin-bottom:22px}.panel h2{font-size:13px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px}.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.funnel-step{margin-bottom:15px}.funnel-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}.funnel-name{font-size:13px;color:var(--muted)}.funnel-number{font-size:18px;font-weight:800}.bar-bg{height:9px;background:var(--panel2);border-radius:99px;overflow:hidden}.bar{height:100%;background:var(--accent);border-radius:99px;min-width:2px}.rate{font-size:11px;color:var(--muted);margin-top:4px}.split{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.mini{background:var(--panel2);border-radius:10px;padding:14px}.mini b{display:block;font-size:20px;margin-top:5px}.mini span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}.chart-wrap{height:300px;position:relative}.note{color:var(--muted);font-size:12px;line-height:1.6;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
.campaign{padding:14px 0;border-top:1px solid var(--line)}.campaign:first-child{border-top:0;padding-top:0}.campaign:last-child{padding-bottom:0}.campaign-head{display:flex;gap:8px;align-items:center;margin-bottom:10px}.campaign-name{font-size:14px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tag{margin-left:auto;color:var(--violet);background:rgba(143,123,255,.15);padding:3px 9px;border-radius:99px;font-size:11px;font-weight:600}.campaign-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:10px 14px}.metric span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}.metric b{font-size:13px;font-variant-numeric:tabular-nums}.source-note{border-left:2px solid var(--accent);padding-left:14px;color:var(--muted);font-size:12px;line-height:1.6}
.weekly-list{display:grid;gap:8px}.weekly-card{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden}.weekly-card[open]{background:#1a1a1f}.weekly-card summary{list-style:none;cursor:pointer;padding:15px 18px;display:grid;grid-template-columns:160px minmax(0,1fr) 24px;align-items:center;gap:14px}.weekly-card summary::-webkit-details-marker{display:none}.weekly-card summary::after{content:'+';display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#24242a;color:var(--accent);font-size:18px;line-height:1}.weekly-card[open] summary::after{content:'−'}.weekly-period{color:var(--accent);font-size:12px;font-weight:600}.weekly-preview{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d7d7dc;font-size:13px}.weekly-card[open] .weekly-preview{display:none}.weekly-card[open] summary{grid-template-columns:minmax(0,1fr) 24px}.weekly-body{padding:0 18px 18px}.weekly-summary{border-top:1px solid var(--line);padding-top:14px;font-size:16px;font-weight:600;line-height:1.45;margin-bottom:14px}.weekly-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.weekly-field{border-top:1px solid var(--line);padding-top:10px;color:#d7d7dc;font-size:13px;line-height:1.55}.weekly-field b{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}.modal{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:20px}.modal-card{position:relative;width:min(760px,100%);height:min(800px,92vh);background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 28px 80px rgba(0,0,0,.55);display:flex;flex-direction:column}.modal-help{color:var(--muted);font-size:12px;line-height:1.45}.modal-close{position:absolute;right:12px;top:10px;z-index:2;width:34px;height:34px;border:0;border-radius:50%;background:#24242a;color:#fff;font-size:22px;cursor:pointer}.weekly-form{overflow:auto;padding:22px;display:grid;gap:14px}.weekly-form h3{font-size:20px;padding-right:44px}.weekly-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.weekly-form label{display:grid;gap:6px;color:var(--muted);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}.weekly-form input,.weekly-form textarea,.weekly-form select{width:100%;border:1px solid var(--line);border-radius:9px;background:var(--panel2);color:var(--text);font:500 13px 'Golos Text';padding:11px 12px;outline:none;color-scheme:dark}.weekly-form input:focus,.weekly-form textarea:focus,.weekly-form select:focus{border-color:rgba(37,221,204,.65)}.weekly-form textarea{min-height:82px;resize:vertical;line-height:1.5}.weekly-form textarea.summary{min-height:112px}.weekly-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.weekly-save{border:0;border-radius:9px;background:var(--accent);color:#06110f;padding:11px 18px;font:800 13px 'Golos Text';cursor:pointer}.weekly-save:disabled{opacity:.55;cursor:wait}.weekly-status{color:var(--muted);font-size:12px}.weekly-status.error{color:var(--red)}.weekly-submit-frame{display:none}
@media(max-width:760px){body{padding:18px 14px 48px}.grid2{grid-template-columns:1fr}.split{grid-template-columns:1fr}.cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.card{padding:14px}.value{font-size:17px}.updated{width:100%;margin-left:0}.chart-wrap{height:260px}.campaign-metrics,.weekly-fields{grid-template-columns:1fr}.weekly-open{width:100%;margin-left:0}.weekly-card summary{grid-template-columns:minmax(0,1fr) 24px}.weekly-preview{grid-column:1 / -1;grid-row:2}.weekly-card[open] summary{grid-template-columns:minmax(0,1fr) 24px}.modal{padding:0}.modal-card{height:100vh;border-radius:0}.weekly-form-grid{grid-template-columns:1fr}.weekly-form{padding:18px}}
</style>`);

document.body.innerHTML = `
<header><div class="brand"><img src="../assets/toys-logo.svg" alt="TOYS"><span class="sep">×</span></div><div class="project">${esc(C.title || 'Instashop')}</div><div id="updated" class="updated"></div></header>
<div id="loading" class="state">Загружаю данные…</div>
<div id="error" class="state hidden"><b>Не удалось загрузить данные.</b><br>Проверь доступ к отчётной таблице.</div>
<div id="content" class="hidden">
  <div class="controls"><div class="seg" id="periodSeg"><button data-days="1">Вчера</button><button data-days="7" class="active">7 дней</button><button data-days="30">30 дней</button><button data-days="max">Максимум</button></div><div class="range"><input id="from" type="date" aria-label="С"><span>–</span><input id="to" type="date" aria-label="По"></div><button id="openWeekly" class="weekly-open${C.weeklyFormUrl?'':' hidden'}">Добавить итог недели</button></div>
  <div class="cards" id="cards"></div>
  <div class="grid2">
    <div class="panel"><h2>Instashop-воронка</h2><div id="funnel"></div></div>
    <div class="panel"><h2>Качество обращений</h2><div id="quality"></div><div class="note">«Заявки» — квалифицированные обращения. «Ціна» — неквалифицированные обращения.</div></div>
  </div>
  <div class="panel"><h2>Еженедельные итоги</h2><div id="weekly"></div></div>
  <div class="panel"><h2>Динамика по дням</h2><div class="chart-wrap"><canvas id="chart"></canvas></div></div>
  <div class="panel"><h2>Кампании Meta Ads</h2><div id="campaigns"></div><div class="note">Продажи и выручка приходят общей суммой за день и не распределяются по рекламным кампаниям. В строках кампаний показаны только рекламные метрики и атрибуция Meta.</div></div>
  <div class="panel"><h2>Методика</h2><div class="source-note">Расход Meta Ads переводится из USD в UAH по официальному курсу НБУ на каждую дату. ROAS = выручка Instagram Direct в UAH / расход Meta Ads в UAH.</div></div>
</div>`;
document.body.insertAdjacentHTML('beforeend', `<div id="weeklyModal" class="modal hidden" role="dialog" aria-modal="true" aria-label="Недельный итог"><div class="modal-card"><button id="closeWeekly" class="modal-close" aria-label="Закрыть">×</button><form id="weeklyForm" class="weekly-form" method="post" target="weeklySubmitFrame"><h3>Недельный итог PROFKIT</h3><div class="modal-help">Одна запись на период. Повторное сохранение обновит существующий итог.</div><input type="hidden" name="mode" value="save"><label>Код доступа<input id="weeklyAccess" name="accessCode" type="password" autocomplete="current-password" required></label><div class="weekly-form-grid"><label>Начало периода<input id="weeklyStart" name="periodStart" type="date" required></label><label>Конец периода<input id="weeklyEnd" name="periodEnd" type="date" required></label></div><label>Общий итог<textarea id="weeklySummary" name="summary" class="summary" maxlength="5000" required></textarea></label><label>Что сработало<textarea id="weeklyWins" name="wins" maxlength="5000"></textarea></label><label>Что не сработало<textarea id="weeklyIssues" name="issues" maxlength="5000"></textarea></label><label>Какие изменения внесли<textarea id="weeklyChanges" name="changes" maxlength="5000"></textarea></label><label>План на следующую неделю<textarea id="weeklyNextSteps" name="nextSteps" maxlength="5000"></textarea></label><label>Статус<select id="weeklyStatusSelect" name="status"><option value="published">Опубликовано</option><option value="draft">Черновик</option></select></label><div class="weekly-actions"><button id="weeklySave" class="weekly-save" type="submit">Сохранить итог</button><div id="weeklyFormStatus" class="weekly-status" aria-live="polite"></div></div></form><iframe id="weeklySubmitFrame" class="weekly-submit-frame" name="weeklySubmitFrame" title="Результат сохранения"></iframe></div></div>`);

function gviz(sheet, ok, fail){
  const cb = '__instashopGviz' + Math.random().toString(36).slice(2);
  const script = document.createElement('script');
  const timer = setTimeout(doneFail, 12000);
  window[cb] = data => { cleanup(); data && data.status !== 'error' ? ok(data) : fail(); };
  script.onerror = doneFail;
  script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler%3A${cb}&headers=1&sheet=${encodeURIComponent(sheet)}&cacheBust=${Date.now()}`;
  document.head.appendChild(script);
  function doneFail(){ cleanup(); fail(); }
  function cleanup(){ clearTimeout(timer); delete window[cb]; script.remove(); }
}

function loadScript(src){
  return new Promise((resolve,reject)=>{ const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s); });
}

Promise.all([
  new Promise((resolve,reject)=>gviz('MetaAds', json=>resolve(M.parseMeta(json)), reject)),
  new Promise((resolve,reject)=>gviz('InstashopSales', json=>resolve(M.parseSales(json)), reject)),
  new Promise(resolve=>gviz('WeeklyComments', json=>resolve(M.parseWeeklyComments(json)), ()=>resolve([]))),
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js')
]).then(([meta,sales,comments])=>{
  META = meta;
  SALES = sales;
  COMMENTS = comments;
  if(!SALES.length) throw new Error('No sales data');
  bind();
  el('loading').classList.add('hidden');
  el('content').classList.remove('hidden');
  const latest = allDates().slice(-1)[0] || '';
  el('updated').textContent = latest ? 'данные по ' + latest : '';
  render();
}).catch(()=>{ el('loading').classList.add('hidden'); el('error').classList.remove('hidden'); });

function allDates(){
  return Array.from(new Set(META.map(r=>r.date).concat(SALES.map(r=>r.date)))).filter(Boolean).sort();
}

function bind(){
  el('periodSeg').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
    el('periodSeg').querySelectorAll('button').forEach(x=>x.classList.remove('active'));
    button.classList.add('active');
    period = button.dataset.days === 'max' ? 'max' : +button.dataset.days;
    render();
  }));
  const inputs = [el('from'), el('to')];
  const dates = allDates();
  const latest = dates.slice(-1)[0] || '';
  inputs.forEach(input=>{ input.min=C.startDate || dates[0] || ''; input.max=latest; input.addEventListener('change',()=>{
    if(el('from').value && el('to').value){
      el('periodSeg').querySelectorAll('button').forEach(x=>x.classList.remove('active'));
      period = {from:el('from').value,to:el('to').value};
      render();
    }
  }); });
  el('openWeekly').addEventListener('click', openWeeklyForm);
  el('closeWeekly').addEventListener('click', closeWeeklyForm);
  el('weeklyModal').addEventListener('click', event=>{ if(event.target === el('weeklyModal')) closeWeeklyForm(); });
  el('weeklyEnd').addEventListener('change', ()=>{
    el('weeklyStart').value = shiftIso(el('weeklyEnd').value, -6);
    fillWeeklyForm();
  });
  el('weeklyForm').addEventListener('submit', async event=>{
    event.preventDefault();
    el('weeklySave').disabled = true;
    weeklySetStatus('Проверяю код…');
    if(!(await weeklyAccessValid(el('weeklyAccess').value))){
      el('weeklySave').disabled = false;
      weeklySetStatus('Неверный код доступа', true);
      return;
    }
    sessionStorage.setItem('profkitWeeklyAccess', el('weeklyAccess').value);
    weeklySubmitPending = true;
    weeklySetStatus('Сохраняю…');
    clearTimeout(weeklySubmitTimer);
    weeklySubmitTimer = setTimeout(()=>{
      if(!weeklySubmitPending) return;
      weeklySubmitPending = false;
      el('weeklySave').disabled = false;
      weeklySetStatus('Сервис долго не отвечает. Попробуйте ещё раз.', true);
    }, 20000);
    el('weeklyForm').submit();
  });
  el('weeklySubmitFrame').addEventListener('load', ()=>{
    if(weeklySubmitPending) weeklySaveSucceeded();
  });
  window.addEventListener('message', event=>{
    if(!weeklySubmitPending || !event.data) return;
    if(event.data.type === 'weekly-comment-error'){
      weeklySubmitPending = false;
      el('weeklySave').disabled = false;
      weeklySetStatus(event.data.message || 'Не удалось сохранить', true);
      return;
    }
    if(event.data.type !== 'weekly-comment-saved') return;
    weeklySaveSucceeded();
  });
}

function openWeeklyForm(){
  if(!C.weeklyFormUrl) return;
  const end = el('to').value || allDates().slice(-1)[0] || '';
  el('weeklyForm').action = C.weeklyFormUrl;
  el('weeklyAccess').value = sessionStorage.getItem('profkitWeeklyAccess') || '';
  el('weeklyEnd').value = end;
  el('weeklyStart').value = shiftIso(end, -6);
  fillWeeklyForm();
  weeklySetStatus('');
  el('weeklyModal').classList.remove('hidden');
  document.body.style.overflow='hidden';
  setTimeout(()=>el(el('weeklyAccess').value ? 'weeklySummary' : 'weeklyAccess').focus(), 0);
}

function closeWeeklyForm(){
  if(weeklySubmitPending) return;
  el('weeklyModal').classList.add('hidden');
  document.body.style.overflow='';
}

function shiftIso(value, days){
  const date = new Date(String(value || '') + 'T00:00:00Z');
  if(!isFinite(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0,10);
}

function weeklySetStatus(text, error){
  el('weeklyFormStatus').textContent = text;
  el('weeklyFormStatus').classList.toggle('error', !!error);
}

async function weeklyAccessValid(value){
  if(!window.crypto || !window.crypto.subtle) return false;
  const bytes = new TextEncoder().encode(String(value || '').trim().toUpperCase());
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,'0')).join('') === WEEKLY_ACCESS_SHA256;
}

function weeklySaveSucceeded(){
  clearTimeout(weeklySubmitTimer);
  weeklySubmitPending = false;
  el('weeklySave').disabled = false;
  const record = weeklyFormRecord();
  COMMENTS = COMMENTS.filter(item=>item.periodEnd !== record.periodEnd).concat(record);
  renderWeekly();
  closeWeeklyForm();
  setTimeout(()=>gviz('WeeklyComments', json=>{ COMMENTS=M.parseWeeklyComments(json); renderWeekly(); }, ()=>{}), 800);
}

function fillWeeklyForm(){
  const item = COMMENTS.find(row=>row.periodEnd === el('weeklyEnd').value);
  if(item){
    el('weeklyStart').value = item.periodStart;
    el('weeklySummary').value = item.summary;
    el('weeklyWins').value = item.wins;
    el('weeklyIssues').value = item.issues;
    el('weeklyChanges').value = item.changes;
    el('weeklyNextSteps').value = item.nextSteps;
    el('weeklyStatusSelect').value = item.status === 'draft' ? 'draft' : 'published';
  }else{
    ['weeklySummary','weeklyWins','weeklyIssues','weeklyChanges','weeklyNextSteps'].forEach(id=>{ el(id).value = ''; });
    el('weeklyStatusSelect').value = 'published';
  }
}

function weeklyFormRecord(){
  return {
    id: el('weeklyEnd').value,
    periodStart: el('weeklyStart').value,
    periodEnd: el('weeklyEnd').value,
    summary: el('weeklySummary').value.trim(),
    wins: el('weeklyWins').value.trim(),
    issues: el('weeklyIssues').value.trim(),
    changes: el('weeklyChanges').value.trim(),
    nextSteps: el('weeklyNextSteps').value.trim(),
    status: el('weeklyStatusSelect').value,
    createdAt: '',
    updatedAt: new Date().toISOString()
  };
}

function selectedDates(){
  const dates = allDates();
  if(!dates.length) return [];
  const latest = dates[dates.length-1];
  if(period === 'max') return M.isoRange(C.startDate || dates[0], latest);
  if(typeof period === 'object') return M.isoRange(period.from, period.to);
  const end = new Date(latest + 'T00:00:00Z');
  const start = new Date(end); start.setUTCDate(end.getUTCDate() - period + 1);
  const min = C.startDate || dates[0];
  const from = start.toISOString().slice(0,10) < min ? min : start.toISOString().slice(0,10);
  return M.isoRange(from, latest);
}

function render(){
  const dates = selectedDates();
  if(!dates.length) return;
  el('from').value = dates[0]; el('to').value = dates[dates.length-1];
  const set = new Set(dates);
  const meta = META.filter(r=>set.has(r.date));
  const sales = SALES.filter(r=>set.has(r.date));
  const s = M.summarize(meta, sales);
  const cards = [
    ['Расход', money(s.spend)], ['Показы', fmt0(s.impressions)], ['Клики', fmt0(s.clicks)], ['CTR', pct(s.ctr)],
    ['Direct-обращения', fmt0(s.direct), `Meta атрибутировала: ${fmt1(s.metaDirect)}`], ['Квал. обращения', fmt0(s.qualified)],
    ['Продажи', fmt0(s.sales)], ['Выручка', money(s.revenue)], ['ROAS', ratio(s.roas)],
    ['Цена квала', s.costPerQualified==null?'—':money(s.costPerQualified)], ['Цена продажи', s.costPerSale==null?'—':money(s.costPerSale)]
  ];
  el('cards').innerHTML = cards.map(c=>`<div class="card"><div class="label">${esc(c[0])}</div><div class="value">${esc(c[1])}${c[2]?`<small>${esc(c[2])}</small>`:''}</div></div>`).join('');

  const steps = [['Показы',s.impressions],['Клики',s.clicks],['Direct-обращения',s.direct],['Квал. обращения',s.qualified],['Продажи',s.sales]];
  el('funnel').innerHTML = steps.map((step,index)=>{
    const previous = index ? steps[index-1][1] : step[1];
    const width = index ? (previous ? Math.min(100, step[1]/previous*100) : 0) : 100;
    const rate = index && previous ? `<div class="rate">${(step[1]/previous*100).toFixed(1)}% от предыдущего шага</div>` : '';
    return `<div class="funnel-step"><div class="funnel-head"><span class="funnel-name">${esc(step[0])}</span><span class="funnel-number">${fmt1(step[1])}</span></div><div class="bar-bg"><div class="bar" style="width:${width}%"></div></div>${rate}</div>`;
  }).join('');

  const unqualRate = s.direct ? s.unqualified/s.direct : null;
  el('quality').innerHTML = `<div class="split"><div class="mini"><span>Квалы</span><b>${fmt0(s.qualified)}</b></div><div class="mini"><span>Неквалы</span><b>${fmt0(s.unqualified)}</b></div><div class="mini"><span>Доля неквалов</span><b>${pct(unqualRate)}</b></div></div><div class="note">Direct → квал.: <b>${pct(s.directToQualified)}</b> · Квал. → продажа: <b>${pct(s.qualifiedToSale)}</b></div>`;
  renderWeekly();
  drawChart(M.dailySeries(dates, meta, sales));
  drawCampaigns(meta, dates[dates.length-1]);
}

function renderWeekly(){
  const comments = M.publishedWeeklyComments(COMMENTS);
  el('weekly').innerHTML = comments.length ? `<div class="weekly-list">${comments.map((item,index)=>{
    const fields = [['Что сработало',item.wins],['Что не сработало',item.issues],['Что изменили',item.changes],['План на следующую неделю',item.nextSteps]].filter(row=>row[1]);
    return `<details class="weekly-card" name="weekly-summary"${index===0?' open':''}><summary><span class="weekly-period">${esc(item.periodStart)} — ${esc(item.periodEnd)}</span><span class="weekly-preview">${esc(item.summary)}</span></summary><div class="weekly-body"><div class="weekly-summary">${lines(item.summary)}</div>${fields.length?`<div class="weekly-fields">${fields.map(row=>`<div class="weekly-field"><b>${esc(row[0])}</b>${lines(row[1])}</div>`).join('')}</div>`:''}</div></details>`;
  }).join('')}</div>` : '<div class="state">Опубликованных недельных итогов пока нет</div>';
}

function drawChart(series){
  if(chart) chart.destroy();
  chart = new Chart(el('chart'), {data:{labels:series.map(x=>x.date.slice(5)),datasets:[
    {type:'line',label:'Расход, UAH',yAxisID:'ySpend',data:series.map(x=>+x.spend.toFixed(2)),borderColor:'#25ddcc',backgroundColor:'transparent',tension:.3,pointRadius:2,borderWidth:2},
    {type:'bar',label:'Direct',yAxisID:'yCount',data:series.map(x=>x.direct),backgroundColor:'rgba(143,123,255,.35)',borderRadius:4},
    {type:'bar',label:'Квалы',yAxisID:'yCount',data:series.map(x=>x.qualified),backgroundColor:'rgba(255,180,84,.35)',borderRadius:4},
    {type:'bar',label:'Продажи',yAxisID:'yCount',data:series.map(x=>x.sales),backgroundColor:'rgba(255,107,129,.35)',borderRadius:4}
  ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:'#888891',boxWidth:12,font:{family:'Golos Text'}}}},scales:{x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#888891'}},ySpend:{position:'left',beginAtZero:true,grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#888891'}},yCount:{position:'right',beginAtZero:true,grid:{display:false},ticks:{color:'#888891'}}}}});
}

function drawCampaigns(periodRows, latest){
  const campaigns = M.aggregateCampaigns(periodRows, META, latest);
  el('campaigns').innerHTML = campaigns.length ? campaigns.map(item=>{
    const ctr = item.impressions ? item.clicks/item.impressions : null;
    const price = item.metaDirect ? item.spendUah/item.metaDirect : null;
    return `<div class="campaign"><div class="campaign-head"><div class="campaign-name" title="${esc(item.campaign)}">${esc(item.campaign)}</div><span class="tag">Meta</span></div><div class="campaign-metrics">
      <div class="metric"><span>Показы</span><b>${fmt0(item.impressions)}</b></div><div class="metric"><span>Клики</span><b>${fmt0(item.clicks)}</b></div><div class="metric"><span>CTR</span><b>${pct(ctr)}</b></div><div class="metric"><span>Расход</span><b>${money(item.spendUah)}</b></div><div class="metric"><span>Direct Meta</span><b>${fmt1(item.metaDirect)}</b></div><div class="metric"><span>Цена Direct</span><b>${price==null?'—':money(price)}</b></div>
    </div></div>`;
  }).join('') : '<div class="state">Нет активных кампаний за последние 30 дней</div>';
}
})();
