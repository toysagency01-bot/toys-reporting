/* ============================================================
   TOYS AGENCY — reporting core
   Один общий движок для мастер-дашборда и всех клиентских.
   Страница задаёт window.DASH_CONFIG = {
     sheetId: 'ID таблицы',
     title:   'Имя на шапке',
     locked:  true|false,   // true = клиентский режим (без выбора аккаунта)
     showDrafts: true|false // показывать ли черновики Insights (мастер)
   }
   ============================================================ */
(function(){
const C = window.DASH_CONFIG || {};
const SHEET_ID = C.sheetId;
const LOCKED = !!C.locked;
const SHOW_DRAFTS = !!C.showDrafts;
const TITLE = C.title || 'reporting';

/* ---------- styles + fonts ---------- */
/* ---------- логотипы ----------
   Логотип агентства общий для всех страниц — путь один раз здесь.
   Логотип клиента задаётся в его собственном index.html через
   DASH_CONFIG.clientLogoUrl (путь относительно папки клиента).       */
const AGENCY_LOGO_URL = '../assets/toys-logo.svg';

document.head.insertAdjacentHTML('beforeend', `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a0a0a;--panel:#121215;--panel-2:#17171b;--line:rgba(255,255,255,.07);
--text:#f2f2f4;--muted:#87878f;--accent:#25ddcc;--accent-dim:rgba(37,221,204,.12);--radius:14px}
*{margin:0;padding:0;box-sizing:border-box}
html{background:var(--bg)}
body{font-family:'Golos Text',system-ui,sans-serif;background:var(--bg);color:var(--text);
min-height:100vh;padding:28px clamp(16px,4vw,48px) 64px}
header{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;padding-bottom:22px;
margin-bottom:22px;border-bottom:1px solid var(--line)}
.logo{font-weight:800;font-size:22px;letter-spacing:.04em}
.logo b{color:var(--accent)}
.logo-row{display:flex;align-items:center;gap:10px}
.logo-row img{display:block;height:26px;width:auto;max-width:140px;object-fit:contain}
.logo-sep{color:var(--muted);font-size:15px;font-weight:300}
.sub{color:var(--muted);font-size:13px}
.updated{margin-left:auto;color:var(--muted);font-size:12px}
.controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:22px}
select{background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:10px;
padding:10px 36px 10px 14px;font:500 14px 'Golos Text',sans-serif;appearance:none;cursor:pointer;outline:none;
background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2387878f' fill='none' stroke-width='1.5'/%3E%3C/svg%3E");
background-repeat:no-repeat;background-position:right 14px center}
select:focus-visible{border-color:var(--accent)}
.seg{display:flex;background:var(--panel);border:1px solid var(--line);border-radius:10px;
overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.seg::-webkit-scrollbar{display:none}
.seg button{background:none;border:none;color:var(--muted);cursor:pointer;padding:10px 16px;
font:500 14px 'Golos Text',sans-serif;white-space:nowrap;flex:0 0 auto}
.seg button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.seg button.active{background:var(--accent-dim);color:var(--accent)}
.daterange{display:flex;align-items:center;gap:6px;background:var(--panel);
border:1px solid var(--line);border-radius:10px;padding:4px 6px;cursor:pointer}
.daterange input[type=date]{background:none;border:none;color:var(--text);
font:500 13px 'Golos Text',sans-serif;padding:6px 8px;outline:none;
color-scheme:dark;cursor:pointer;min-width:108px}
.daterange input[type=date]:focus-visible{outline:2px solid var(--accent);outline-offset:1px;border-radius:4px}
.dr-sep{color:var(--muted);font-size:13px}
.cards{display:grid;gap:12px;margin-bottom:22px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px 18px 16px}
.card .label{color:var(--muted);font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px}
.card .value{font-size:clamp(20px,2.4vw,28px);font-weight:800;font-variant-numeric:tabular-nums;line-height:1.15}
.card .value small{display:block;font-size:15px;font-weight:600;opacity:.85;margin-top:2px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:20px;margin-bottom:22px}
.panel h2{font-size:14px;font-weight:600;color:var(--muted);margin-bottom:16px;letter-spacing:.04em;text-transform:uppercase}
.chart-wrap{position:relative;height:280px}
.table-wrap{overflow-x:auto}
.table-wrap table{min-width:auto;table-layout:fixed}
.table-wrap td,.table-wrap th{white-space:normal;overflow-wrap:break-word}
table{width:100%;border-collapse:collapse;font-size:14px;min-width:760px}
th{text-align:left;color:var(--muted);font-weight:500;font-size:12px;letter-spacing:.04em;
text-transform:uppercase;padding:0 12px 12px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:12px;border-bottom:1px solid var(--line);text-align:left;
font-variant-numeric:tabular-nums;white-space:nowrap}
td.camp{max-width:340px;overflow:hidden;text-overflow:ellipsis}
tr:hover td{background:var(--panel-2)}
tr:last-child td{border-bottom:none}
.insight{border-left:2px solid var(--accent);padding:4px 0 4px 16px;margin-bottom:18px}
.insight:last-child{margin-bottom:0}
.insight .when{color:var(--muted);font-size:12px;margin-bottom:6px}
.insight .when .draft{color:#ffb454;margin-left:8px}
.insight p{font-size:14px;line-height:1.65;margin-bottom:6px}
.insight p b{color:var(--accent);font-weight:600}
.state{padding:60px 20px;text-align:center;color:var(--muted);font-size:14px;line-height:1.7}
.state b{color:var(--text)}
.hidden{display:none}
.tabs{display:flex;gap:4px;margin-bottom:22px;border-bottom:1px solid var(--line);
overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tabs button{background:none;border:none;color:var(--muted);cursor:pointer;
padding:10px 18px 12px;font:600 14px 'Golos Text',sans-serif;
border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap;flex:0 0 auto}
.tabs button.active{color:var(--accent);border-bottom-color:var(--accent)}
.tabs button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.ptotal{display:flex;align-items:center;gap:14px;margin-bottom:20px}
.pbar{flex:1;height:8px;background:var(--panel-2);border-radius:99px;overflow:hidden}
.pfill{height:100%;background:var(--accent);border-radius:99px;transition:width .4s ease}
.ppct{font-weight:800;font-size:18px;font-variant-numeric:tabular-nums;min-width:52px;text-align:right}
.ptopic{display:grid;grid-template-columns:1fr auto;column-gap:12px;row-gap:7px;
padding:11px 0;border-top:1px solid var(--line)}
.ptopic .tname{grid-column:1;grid-row:1;font-size:14px;align-self:center}
.ptopic .tcount{grid-column:2;grid-row:1;color:var(--muted);font-size:12px;
font-variant-numeric:tabular-nums;align-self:center;white-space:nowrap}
.ptopic .pbar{grid-column:1 / -1;grid-row:2;height:6px}
.badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;white-space:nowrap}
.b-done{background:var(--accent-dim);color:var(--accent)}
.b-progress{background:rgba(255,180,84,.12);color:#ffb454}
.b-plan{background:var(--panel-2);color:var(--muted)}
.b-na{background:none;color:var(--muted);opacity:.6}
.wait{border-left:2px solid #ffb454;padding:4px 0 4px 16px;margin-bottom:14px}
.wait:last-child{margin-bottom:0}
.wait .wtask{font-size:14px;line-height:1.5}
.wait .wmeta{color:var(--muted);font-size:12px;margin-top:3px}
.task-group{margin-top:18px}
.task-group:first-child{margin-top:0}
.task-group-title{font-size:13px;font-weight:600;color:var(--accent);
margin-bottom:8px;letter-spacing:.02em}
.task-row{display:flex;align-items:center;gap:12px;padding:10px 0;
border-top:1px solid var(--line)}
.task-group .task-row:first-of-type{border-top:none}
.task-main{flex:1;min-width:0}
.task-name{font-size:14px;line-height:1.4}
.task-meta{color:var(--muted);font-size:12px;margin-top:2px}
@media (max-width: 640px){
  .task-row{flex-wrap:wrap;gap:4px 0;padding:11px 0}
  .task-main{flex:1 1 100%}
  .badge{margin-left:0}
}
.camp-row{padding:12px 0;border-top:1px solid var(--line)}
.task-group .camp-row:first-of-type{border-top:none}
.camp-head{display:flex;align-items:center;gap:8px;margin-bottom:9px}
.camp-name{font-size:14px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chan-tag{flex:0 0 auto;font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;white-space:nowrap}
.chan-tag.meta{background:rgba(143,123,255,.15);color:#8f7bff}
.chan-tag.google{background:var(--accent-dim);color:var(--accent)}
.camp-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 10px}
.camp-metrics .m{min-width:0}
.camp-metrics .mlabel{display:block;color:var(--muted);font-size:10px;letter-spacing:.04em;
text-transform:uppercase;margin-bottom:1px}
.camp-metrics .mval{font-size:13px;font-variant-numeric:tabular-nums;font-weight:600}
.wk-block{margin-top:22px;padding-top:18px;border-top:1px solid var(--line)}
.wk-block:first-child{margin-top:0;padding-top:0;border-top:none}
.wk-title{font-size:14px;font-weight:700;color:var(--accent);margin-bottom:10px}
.wk-totals td{font-weight:700;border-top:1px solid var(--line)}
.wk-notes{margin-top:12px;padding:12px 14px;background:var(--panel-2);border-radius:10px}
.wk-notes p{font-size:13px;line-height:1.6;color:var(--text);margin-bottom:6px}
.wk-notes p:last-child{margin-bottom:0}
.comp-card{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}
.comp-card:first-child{margin-top:0;padding-top:0;border-top:none}
.comp-title{font-size:15px;font-weight:700;color:var(--accent);margin-bottom:10px}
.comp-row{padding:8px 0;border-top:1px solid var(--line)}
.comp-card .comp-row:first-of-type{border-top:none}
.comp-attr{font-size:11px;color:var(--muted);letter-spacing:.03em;text-transform:uppercase;margin-bottom:2px}
.comp-result{font-size:14px;line-height:1.5}
.comp-notes{font-size:12px;color:var(--muted);line-height:1.5;margin-top:4px;font-style:italic}
.comp-summary{margin-top:20px;padding:14px;background:var(--panel-2);border-radius:10px}
.comp-summary p{font-size:13px;line-height:1.6;margin-bottom:6px}
.comp-summary p:last-child{margin-bottom:0}
a{color:var(--accent);text-decoration:underline;word-break:break-all}
a:hover{opacity:.8}

/* дельты период-к-периоду на KPI-карточках */
.delta{font-size:12px;font-weight:600;margin-left:6px;white-space:nowrap;vertical-align:middle}
.delta-good{color:var(--accent)}
.delta-bad{color:#ff6b81}
.delta-neutral{color:var(--muted)}

/* воронка + каналы бок о бок */
.cards-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:22px}
.funnel-step{margin-bottom:16px}
.funnel-step:last-child{margin-bottom:0}
.funnel-row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
.funnel-label{font-size:13px;color:var(--muted)}
.funnel-value{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
.funnel-bar-wrap{height:10px;background:var(--panel-2);border-radius:99px;overflow:hidden}
.funnel-bar{height:100%;background:var(--accent);border-radius:99px;transition:width .4s ease}
.funnel-rate{margin-top:4px;font-size:11px;color:var(--muted)}

/* разбивка по каналам */
.chan-block{margin-bottom:0}
.chan-legend{display:flex;gap:16px;font-size:12px;color:var(--muted);margin-bottom:6px}
.chan-legend b{color:var(--text)}
.chan-split{display:flex;height:18px;border-radius:6px;overflow:hidden;margin-bottom:5px}
.chan-split div{height:100%;transition:width .4s ease}
.seg-google{background:var(--accent)}
.seg-meta{background:#8f7bff}
.chan-caption{font-size:11px;color:var(--muted)}

.fmt-table{width:100%;border-collapse:collapse;font-size:13px}
.fmt-table th,.fmt-table td{padding:10px 14px;text-align:right;border-bottom:1px solid var(--line)}
.fmt-table th:first-child,.fmt-table td:first-child{text-align:left;color:var(--muted)}
.fmt-table th{color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.03em}
.fmt-table tr:last-child td{border-bottom:none}
.fmt-table td:first-child{font-weight:700;color:var(--text)}
@media (max-width:760px){.fmt-table{font-size:12px}.fmt-table th,.fmt-table td{padding:8px 6px}}

.wd-metric{margin-bottom:16px}
.wd-metric:last-child{margin-bottom:0}
.wd-metric-label{font-size:11px;color:var(--muted);text-transform:uppercase;
letter-spacing:.04em;margin-bottom:6px}
.wd-days{display:flex;align-items:flex-end;gap:5px;height:48px}
.wd-day{flex:1;display:flex;flex-direction:column;align-items:center;
justify-content:flex-end;height:100%;position:relative}
.wd-day[data-tip]:hover::after{
  content:attr(data-tip);position:absolute;bottom:100%;left:50%;
  transform:translateX(-50%);margin-bottom:6px;background:var(--panel-2);
  color:var(--text);font-size:11px;font-weight:600;padding:4px 9px;
  border-radius:6px;white-space:nowrap;border:1px solid var(--line);
  pointer-events:none;z-index:10;
}
.wd-bar{width:100%;border-radius:3px 3px 0 0;min-height:2px;transition:height .3s ease}
.wd-spend{background:var(--accent)}
.wd-impr{background:#8f7bff}
.wd-conv{background:#ffb454}
.wd-daylabel{font-size:10px;color:var(--muted);margin-top:4px}

/* переключатель графика Объём/Эффективность */
.panel-head{display:flex;align-items:center;justify-content:space-between;
flex-wrap:wrap;gap:10px;margin-bottom:16px}
.panel-head h2{margin-bottom:0}
.seg-sm button{padding:7px 12px;font-size:12px}
.cb-card{margin-top:14px;padding:12px 0;border-top:1px solid var(--line)}
.task-group .cb-card:first-of-type{margin-top:0;padding-top:0;border-top:none}
.cb-label{font-size:13px;font-weight:700;color:var(--text);margin-bottom:5px}
.cb-hyp{font-size:14px;line-height:1.55;margin-bottom:8px}
.cb-meta{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12px;color:var(--muted);margin-bottom:6px}
.cb-audience{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:6px}
.cb-status{display:flex;flex-wrap:wrap;gap:6px}
@media (max-width: 640px){
  .cards{grid-template-columns:repeat(2,1fr);gap:8px}
  .card{padding:14px 14px 12px}
  .card .label{font-size:11px;margin-bottom:6px}
  .card .value{font-size:19px}
  .card .value small{font-size:13px}
  .table-wrap{overflow-x:visible}
  .table-wrap table{min-width:0;table-layout:auto}
  .table-wrap thead{display:none}
  .table-wrap tr{display:block;border-bottom:1px solid var(--line);padding:12px 0}
  .table-wrap tr:last-child{border-bottom:none}
  .table-wrap td{display:block;width:auto;max-width:none;text-align:left;border:none;
    padding:3px 0;white-space:normal}
  .table-wrap td.camp{max-width:none}
  .table-wrap td::before{content:attr(data-label);display:block;color:var(--muted);
    font-size:11px;letter-spacing:.04em;text-transform:uppercase;margin-bottom:1px}
}
@media (prefers-reduced-motion:no-preference){
.card,.panel{animation:rise .35s ease both}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}
</style>`);

/* ---------- markup ---------- */
const HAS_PROJECT = !!C.projectSheetId;
const CHANNELS = C.projectChannels || null;
const HAS_CHANNELS = HAS_PROJECT && !!(CHANNELS && CHANNELS.length);
document.body.innerHTML = `
<header>
  <div class="logo-row">
    <img src="${AGENCY_LOGO_URL}" alt="TOYS"
      onerror="this.outerHTML='<div class=&quot;logo&quot;>TOYS<b>.</b></div>'">
    ${C.clientLogoUrl ? `
    <span class="logo-sep">×</span>
    <img src="${esc(C.clientLogoUrl)}" alt="${esc(TITLE)}"
      onerror="this.style.display='none'">` : ''}
  </div>
  <div class="sub">${esc(TITLE)}</div>
  <div class="updated" id="updated"></div>
</header>
${HAS_PROJECT ? `
<nav class="tabs" id="viewTabs">
  <button data-view="metrics" class="active">Показатели</button>
  ${HAS_CHANNELS
    ? CHANNELS.map(ch=>`<button data-view="${esc(ch.key)}">${esc(ch.label)}</button>`).join('')
    : '<button data-view="project">Проект</button>'}
</nav>` : ''}
<div id="metricsView">
<div class="controls hidden" id="controls">
  ${LOCKED ? '' : '<select id="accountSelect" aria-label="Аккаунт"></select>'}
  <div class="seg hidden" role="group" aria-label="Канал" id="platformSeg">
    <button data-platform="__all" class="active">Все каналы</button>
    <button data-platform="Google Ads">Google</button>
    <button data-platform="Meta Ads">Meta</button>
  </div>
  <div class="seg" role="group" aria-label="Период" id="periodSeg">
    <button data-days="1">Вчера</button>
    <button data-days="7" class="active">7 дней</button>
    <button data-days="30">30 дней</button>
    <button data-days="max">Максимум</button>
  </div>
  <div class="daterange" id="dateRange">
    <input type="date" id="dateFrom" aria-label="С">
    <span class="dr-sep">–</span>
    <input type="date" id="dateTo" aria-label="По">
  </div>
</div>
<div class="state" id="loading">Загружаю данные…</div>
<div class="state hidden" id="errorState"><b>Не удалось загрузить данные.</b><br>
Проверь доступ к таблице: «Все, у кого есть ссылка — Читатель».</div>
<div class="state hidden" id="emptyState"><b>За выбранный период данных нет.</b><br>
Попробуй другой период.</div>
<div id="content" class="hidden">
  <div class="cards">
    <div class="card"><div class="label">Расход</div><div class="value" id="kSpend">—</div></div>
    <div class="card"><div class="label">Показы</div><div class="value" id="kImpr">—</div></div>
    <div class="card"><div class="label">Клики</div><div class="value" id="kClicks">—</div></div>
    <div class="card"><div class="label">CTR</div><div class="value" id="kCtr">—</div></div>
    <div class="card"><div class="label">Конверсии</div><div class="value" id="kConv">—</div></div>
    <div class="card"><div class="label">CPA</div><div class="value" id="kCpa">—</div></div>
    <div class="card hidden" id="kQualCard"><div class="label">Квал-лидов</div><div class="value" id="kQual">—</div></div>
    <div class="card hidden" id="kQualCpaCard"><div class="label">Цена квала</div><div class="value" id="kQualCpa">—</div></div>
  </div>
  <div class="panel hidden" id="insightsPanel">
    <h2>Выводы и план</h2>
    <div id="insightsList"></div>
  </div>
  <div class="cards-row">
    <div class="panel">
      <h2>Воронка</h2>
      <div id="funnel"></div>
    </div>
    <div class="panel">
      <h2>По дням недели</h2>
      <div id="weekdayBreakdown"></div>
    </div>
    <div class="panel hidden" id="channelPanel">
      <h2>Каналы</h2>
      <div id="channelBreakdown"></div>
    </div>
  </div>
  <div class="panel hidden" id="formatPanel">
    <h2>Форматы креативов</h2>
    <div id="formatTable"></div>
  </div>
  <div class="panel">
    <div class="panel-head">
      <h2>Динамика по дням</h2>
      <div class="seg seg-sm" id="chartModeSeg">
        <button data-mode="volume" class="active">Объём</button>
        <button data-mode="efficiency">Эффективность</button>
      </div>
    </div>
    <div class="chart-wrap"><canvas id="chart"></canvas></div>
  </div>
  <div class="panel">
    <h2>Кампании</h2>
    <div id="campList"></div>
  </div>
</div>
</div>
${HAS_PROJECT ? `
<div id="projectView" class="hidden">
  <div class="seg hidden" id="projectSubNav" role="group" aria-label="Раздел проекта"></div>
  <div id="planSection">
    <div class="state" id="pLoading">Загружаю план проекта…</div>
    <div class="state hidden" id="pError"><b>Не удалось загрузить план проекта.</b><br>
    Проверь доступ к проектной таблице: «Все, у кого есть ссылка — Читатель».</div>
    <div id="pContent" class="hidden">
      <div class="panel">
        <h2>Прогресс проекта</h2>
        <div class="ptotal"><div class="pbar"><div class="pfill" id="pTotalFill"></div></div>
        <div class="ppct" id="pTotalPct"></div></div>
        <div id="pTopics"></div>
      </div>
      <div class="panel hidden" id="pWaitPanel">
        <h2>Ждём от вас</h2>
        <div id="pWaitList"></div>
      </div>
      <div class="panel">
        <h2>Все задачи</h2>
        <div id="pTaskList"></div>
      </div>
    </div>
  </div>
  <div id="genericSection" class="hidden">
    <div class="state" id="gLoading">Загружаю…</div>
    <div class="state hidden" id="gError"><b>Недостаточно данных для отображения.</b><br>
    Если раздел должен быть заполнен — проверь доступ к проектной таблице и название листа.</div>
    <div class="panel hidden" id="gPanel">
      <h2 id="gTitle"></h2>
      <div id="gWrap"></div>
    </div>
  </div>
</div>` : ''}`;

/* ---------- state ---------- */
const CUR = {USD:'$',EUR:'€',GBP:'£',PLN:'zł',CZK:'Kč',GEL:'₾',UAH:'₴',CHF:'CHF'};
const sym = c => CUR[c] || (c ? c+' ' : '');
const fmtN = n => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n);
const fmtM = n => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:n<10?2:0}).format(n);

let DATA = [], INSIGHTS = [], QUALIFIED = [];
let period = 7, account = '__all', platform = '__all', chart = null, chartMode = 'volume';

/* ---------- boot: Chart.js -> данные (оба канала) -> insights -> квал-лиды (опционально) ---------- */
loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js', () => {
  const finish = (google, meta) => {
    DATA = [...(google || []), ...(meta || [])];
    // Рекламных данных пока может не быть (новый клиент без кабинетов) —
    // это не ошибка. Раздел "Показатели" сам покажет обычное "данных нет"
    // при рендере, а "Проект" как обычно работает независимо от этого.
    if(!SHEET_ID){ INSIGHTS = []; loadQualified(); return; }
    gviz('Insights', j2 => { INSIGHTS = parseInsights(j2); loadQualified(); },
         () => { INSIGHTS = []; loadQualified(); });
  };

  if(!SHEET_ID){
    // sheetId ещё не задан (кабинетов нет вообще) — не тратим 12 секунд
    // на заведомо обречённый запрос, сразу идём дальше с пустыми данными
    finish(null, null);
    return;
  }

  let google = null, meta = null, done = 0;
  const onOne = () => { if (++done >= 2) finish(google, meta); };
  gviz('GoogleAds', j => { google = parseData(j, 'Google Ads'); onOne(); }, onOne);
  gviz('MetaAds',  j => { meta   = parseData(j, 'Meta Ads');   onOne(); }, onOne);
});

/* Лист "QualifiedLeads" общий на всех клиентов и живёт в мастер-таблице
   (не в таблице конкретного клиента) — читаем оттуда явно по ID и
   фильтруем по клиенту через C.showQualified (строка-ключ, а не просто true/false) */
const QUALIFIED_MASTER_SHEET_ID = '1UlIKi-mlH86zMjrczRgZzzPPHP0AcAaQCjLtuYZDi0g';
function loadQualified(){
  if (!C.showQualified) { loadFormats(); return; }
  gvizFrom(QUALIFIED_MASTER_SHEET_ID, 'QualifiedLeads',
       j => { QUALIFIED = parseQualified(j); loadFormats(); },
       () => { QUALIFIED = []; loadFormats(); });
}

/* Лист "MetaAdsFormat" — формат креативов (видео/статика/карусель) по
   дням, живёт в СВОЕЙ таблице клиента (не в мастере), как GoogleAds/MetaAds.
   Читаем всегда: у клиентов без Meta или без данных панель просто скроется. */
let FORMATS = [];
function loadFormats(){
  if(!SHEET_ID){ FORMATS = []; start(); return; }
  gviz('MetaAdsFormat', j => { FORMATS = parseFormats(j); start(); },
       () => { FORMATS = []; start(); });
}

function parseFormats(json){
  const rawRows = ((json.table && json.table.rows) || []);
  const out = [];
  rawRows.forEach(r => {
    const cells = r.c || [];
    const d = cellDate(cells[0]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    const client = cells[1] && cells[1].v != null ? String(cells[1].v).trim() : '';
    const format = cells[2] && cells[2].v != null ? String(cells[2].v).trim() : '';
    const currency = cells[3] && cells[3].v != null ? String(cells[3].v).trim() : '';
    if (!format) return;
    out.push({
      date: d, client, format, currency,
      impr: num(cells[4]), clicks: num(cells[5]), cost: num(cells[6]), conv: num(cells[7])
    });
  });
  return out;
}

/* строки вида: date (ГГГГ-ММ-ДД) | client | qualified_count (число).
   ВАЖНО: Google Sheets может сам превратить записанную текстом дату
   в настоящий тип "дата" — используем тот же безопасный разбор, что
   и для остальных дат в файле (cellDate), а не наивное сравнение строк.
   Фильтруем сразу по клиенту (C.showQualified — это его ключ, например "MyPulse"). */
function parseQualified(json){
  const rawRows = ((json.table && json.table.rows) || []);
  const out = [];
  rawRows.forEach(r => {
    const cells = r.c || [];
    const d = cellDate(cells[0]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return; // строка заголовка или мусор — пропускаем
    const client = cells[1] && cells[1].v != null ? String(cells[1].v).trim() : '';
    if (client !== C.showQualified) return; // не наш клиент — пропускаем
    out.push({ date: d, count: num(cells[2]) });
  });
  return out;
}

function start(){
  if(!LOCKED) buildAccountSelect();
  document.getElementById('controls').classList.remove('hidden');

  // фильтр каналов показываем только если данных больше одного канала
  const platforms = [...new Set(DATA.map(r=>r.platform))];
  if(platforms.length > 1){
    const seg = el('platformSeg');
    seg.classList.remove('hidden');
    seg.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click',()=>{
        seg.querySelectorAll('button').forEach(x=>x.classList.remove('active'));
        b.classList.add('active'); platform = b.dataset.platform; render();
      });
    });
  }
  document.querySelectorAll('#periodSeg button').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('#periodSeg button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      period = b.dataset.days === 'max' ? 'max' : +b.dataset.days;
      dFrom.value = ''; dTo.value = '';
      render();
    });
  });

  // произвольный диапазон дат — при выборе обеих дат снимаем активность
  // с кнопок-заготовок и переключаемся на кастомный период
  const dFrom = el('dateFrom'), dTo = el('dateTo');
  function applyCustomRange(){
    // подстраховка: не даём диапазону уехать позже вчера, даже если
    // виджет браузера не полностью соблюдает атрибут max
    if(dFrom.value > dFrom.max) dFrom.value = dFrom.max;
    if(dTo.value > dTo.max) dTo.value = dTo.max;
    if(dFrom.value && dTo.value){
      document.querySelectorAll('#periodSeg button').forEach(x=>x.classList.remove('active'));
      period = {from: dFrom.value, to: dTo.value};
      render();
    }
  }
  dFrom.addEventListener('change', applyCustomRange);
  dTo.addEventListener('change', applyCustomRange);

  // клик в любом месте поля открывает календарь, не только по иконке
  [dFrom, dTo].forEach(inp => {
    inp.addEventListener('click', () => {
      try{ inp.showPicker(); }catch(e){}
    });
  });

  // переключатель графика: объём (расход/конверсии) vs эффективность (CPA/CTR)
  document.querySelectorAll('#chartModeSeg button').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('#chartModeSeg button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); chartMode = b.dataset.mode; render();
    });
  });

  // ограничиваем календарь реальным диапазоном: снизу — по данным,
  // сверху — жёстко вчера (данные позже вчера появиться не могут)
  const allDates = DATA.map(r=>r.date)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const y = new Date(); y.setDate(y.getDate()-1);
  const yesterday = y.toISOString().slice(0,10);
  if(allDates.length){
    dFrom.min = dTo.min = allDates[0];
  }
  dFrom.max = dTo.max = yesterday;

  const sel = document.getElementById('accountSelect');
  if(sel) sel.addEventListener('change', e=>{ account = e.target.value; render(); });
  const last = DATA.reduce((m,r)=> r.date>m? r.date:m, '');
  document.getElementById('updated').textContent = last ? ('данные по ' + last) : 'реклама ещё не подключена';
  render();

  if(HAS_CHANNELS) initChannels();
  else if(HAS_PROJECT) initProject();
}

/* ---------- загрузка (JSONP: работает с file:// и с хостинга) ---------- */
let cbSeq = 0;
function gviz(sheetName, ok, fail){ gvizFrom(SHEET_ID, sheetName, ok, fail); }
// raw=true просит Google не угадывать самому, где шапка (headers=0) —
// для листов с нестандартной раскладкой (пустые первые колонки, шапка не
// в первой строке) автоопределение Google иногда промахивается и отдаёт
// пустые заголовки; тогда шапку ищем сами в renderGeneric
function gvizFrom(spreadsheetId, sheetName, ok, fail, raw){
  const cb = '__gvizCb' + (++cbSeq);
  const timer = setTimeout(()=>{ cleanup(); fail(); }, 12000);
  window[cb] = json => {
    cleanup();
    if(json && json.status === 'error') fail(); else ok(json);
  };
  const s = document.createElement('script');
  s.src = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=responseHandler%3A${cb}&sheet=${encodeURIComponent(sheetName)}` +
    (raw ? '&headers=0' : '');
  s.onerror = ()=>{ cleanup(); fail(); };
  document.head.appendChild(s);
  function cleanup(){ clearTimeout(timer); delete window[cb]; s.remove(); }
}

function loadScript(src, cb){
  const s = document.createElement('script');
  s.src = src; s.onload = cb;
  s.onerror = ()=>show('errorState');
  document.head.appendChild(s);
}

/* ---------- парсинг ---------- */
function cellDate(c){
  if(!c) return '';
  let v = c.v;
  if(typeof v === 'string' && v.startsWith('Date(')){
    const [y,m,d] = v.slice(5,-1).split(',').map(Number);
    return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  if(c.f && /\d{4}-\d{2}-\d{2}/.test(c.f)) return c.f;
  return String(v).slice(0,10);
}
const num = c => c && c.v != null ? Number(c.v) || 0 : 0;
const str = c => c && c.v != null ? String(c.v) : '';

function parseData(json, defaultPlatform){
  const rows = (json && json.table && json.table.rows) || [];
  const out = [];
  for(const r of rows){
    const c = r.c;
    if(!c || !c[0]) continue;
    // берём строку, только если в первой колонке реальная дата.
    // Если листа GoogleAds/MetaAds в таблице нет, Google молча отдаёт
    // ПЕРВЫЙ лист вместо ошибки — без этой проверки его содержимое
    // распарсилось бы как рекламные данные и показало мусор.
    const d = cellDate(c[0]);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    out.push({
      date: d, platform: str(c[1]) || defaultPlatform,
      account: str(c[2]), currency: str(c[4]),
      campaign: str(c[5]), impr: num(c[6]), clicks: num(c[7]),
      cost: num(c[8]), conv: num(c[9]),
    });
  }
  return out;
}

function parseInsights(json){
  const rows = (json && json.table && json.table.rows) || [];
  const out = [];
  for(const r of rows){
    const c = r.c;
    if(!c || !c[0]) continue;
    const status = str(c[4]).toLowerCase().trim();
    if(status !== 'approved' && !(SHOW_DRAFTS && status === 'draft')) continue;
    out.push({
      date: cellDate(c[0]), periodLabel: str(c[1]),
      insight: str(c[2]), plan: str(c[3]), status,
    });
  }
  return out.sort((a,b)=> a.date < b.date ? 1 : -1).slice(0, 5);
}

/* ---------- рендер ---------- */
function periodDates(){
  if(period === 'max'){
    const adDates = DATA.map(r=>r.date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    // квал-лиды из CRM могут уходить дальше в прошлое, чем рекламные данные
    // (например, клиент недавно подключил трекинг рекламы, но CRM велась
    // давно) — учитываем обе границы, а не только рекламные даты
    const qualDates = (C.showQualified ? QUALIFIED.map(q=>q.date) : []);
    const allDates = adDates.concat(qualDates).sort();
    if(!allDates.length) return [];
    // верхняя граница — не последняя дата в данных (синк может немного
    // отставать), а вчера по календарю: иначе "Максимум" может оказаться
    // уже, чем "30 дней", и потерять свежие записи
    const y = new Date(); y.setDate(y.getDate()-1);
    const yesterday = y.toISOString().slice(0,10);
    const upper = allDates[allDates.length-1] > yesterday ? allDates[allDates.length-1] : yesterday;
    return dateRangeArray(allDates[0], upper);
  }
  if(typeof period === 'object' && period !== null){
    return dateRangeArray(period.from, period.to);
  }
  const dates = [];
  const end = new Date(); end.setDate(end.getDate()-1);
  for(let i=period-1;i>=0;i--){
    const d = new Date(end); d.setDate(end.getDate()-i);
    dates.push(d.toISOString().slice(0,10));
  }
  return dates;
}

function dateRangeArray(fromStr, toStr){
  const dates = [];
  const f = fromStr.split('-').map(Number);
  const t = toStr.split('-').map(Number);
  let cur = Date.UTC(f[0], f[1]-1, f[2]);
  const end = Date.UTC(t[0], t[1]-1, t[2]);
  if(!isFinite(cur) || !isFinite(end) || cur > end) return [];
  while(cur <= end){
    dates.push(new Date(cur).toISOString().slice(0,10));
    cur += 86400000; // +1 день в мс — безопасно в UTC, без сдвигов часовых поясов
  }
  return dates;
}

function render(){
  const dates = periodDates();
  const set = new Set(dates);
  const rows = DATA.filter(r => set.has(r.date)
    && (account==='__all' || r.account===account)
    && (platform==='__all' || r.platform===platform));
  if(!rows.length){ show('emptyState'); return; }
  show('content');

  const impr = rows.reduce((s,r)=>s+r.impr,0);
  const clicks = rows.reduce((s,r)=>s+r.clicks,0);
  const conv = rows.reduce((s,r)=>s+r.conv,0);
  const byCur = {};
  rows.forEach(r=>{ byCur[r.currency]=(byCur[r.currency]||0)+r.cost; });
  const curs = Object.keys(byCur).sort();

  // прошлый период той же длины — для сравнения (недоступно для "Максимум")
  const prevDates = previousPeriodDates(dates);
  const prevSet = new Set(prevDates);
  const prevRows = prevDates.length ? DATA.filter(r => prevSet.has(r.date)
    && (account==='__all' || r.account===account)
    && (platform==='__all' || r.platform===platform)) : [];
  const pImpr = prevRows.reduce((s,r)=>s+r.impr,0);
  const pClicks = prevRows.reduce((s,r)=>s+r.clicks,0);
  const pConv = prevRows.reduce((s,r)=>s+r.conv,0);
  const pCtr = pImpr ? pClicks/pImpr*100 : null;
  const pCost = prevRows.reduce((s,r)=>s+r.cost,0);
  const pCpa = pConv ? pCost/pConv : null;

  el('kSpend').innerHTML = (curs.length===1
      ? `${fmtM(byCur[curs[0]])} ${sym(curs[0])}`
      : curs.map(c=>`<small>${fmtM(byCur[c])} ${sym(c)}</small>`).join(''))
    + (curs.length===1 ? deltaBadge(byCur[curs[0]], pCost, {neutral:true}) : '');
  el('kImpr').innerHTML = fmtN(impr) + deltaBadge(impr, pImpr, {});
  el('kClicks').innerHTML = fmtN(clicks) + deltaBadge(clicks, pClicks, {});
  const ctr = impr ? clicks/impr*100 : null;
  el('kCtr').innerHTML = (ctr!=null ? ctr.toFixed(2)+'%' : '—') + deltaBadge(ctr, pCtr, {});
  el('kConv').innerHTML = fmtM(conv) + deltaBadge(conv, pConv, {});

  let kCpaHtml = '—';
  if (conv) {
    if (curs.length === 1) {
      const cc = rows.filter(r=>r.currency===curs[0]).reduce((s,r)=>s+r.conv,0);
      kCpaHtml = cc ? `${fmtM(byCur[curs[0]]/cc)} ${sym(curs[0])}` : '—';
    } else {
      kCpaHtml = curs.map(c=>{
        const cc = rows.filter(r=>r.currency===c).reduce((s,r)=>s+r.conv,0);
        return cc ? `<small>${fmtM(byCur[c]/cc)} ${sym(c)}</small>` : '';
      }).join('');
    }
  }
  el('kCpa').innerHTML = kCpaHtml + (conv && curs.length===1 ? deltaBadge(byCur[curs[0]]/conv, pCpa, {invert:true}) : '');

  // квал-лиды (Zoho) — показываем только если у клиента включён флаг
  // и по выбранному периоду реально есть данные
  if (C.showQualified) {
    const qualRows = QUALIFIED.filter(q => set.has(q.date));
    const qualTotal = qualRows.reduce((s,q)=>s+q.count, 0);
    if (qualTotal > 0) {
      el('kQualCard').classList.remove('hidden');
      el('kQual').textContent = fmtN(qualTotal);
      if (curs.length === 1) {
        el('kQualCpaCard').classList.remove('hidden');
        el('kQualCpa').textContent = `${fmtM(byCur[curs[0]]/qualTotal)} ${sym(curs[0])}`;
      } else {
        el('kQualCpaCard').classList.add('hidden');
      }
    } else {
      el('kQualCard').classList.add('hidden');
      el('kQualCpaCard').classList.add('hidden');
    }
  }
  layoutCardsGrid();

  drawInsights();
  renderFunnel(impr, clicks, conv);
  renderWeekdays(rows);
  renderChannels(rows, curs);
  renderFormatPanel();
  drawChart(dates, rows, curs);
  drawTable(rows);
}

// вычисляет % изменения и рисует стрелку-бейдж рядом со значением карточки.
// opts.invert: true — если "меньше" считается лучше (например, CPA)
// opts.neutral: true — не красим (например, расход сам по себе не хорош/плох)
// считает столбцы так, чтобы видимые KPI-карточки всегда ложились
// ровно в 2 параллельных ряда — вместо того чтобы жадно переливаться
// и оставлять одну карточку одиноко висеть на второй строке
function layoutCardsGrid(){
  const wrap = document.querySelector('.cards');
  if (!wrap) return;
  const visible = Array.from(wrap.children).filter(c => !c.classList.contains('hidden'));
  const n = visible.length;
  if (window.innerWidth < 640) {
    wrap.style.gridTemplateColumns = 'repeat(2, 1fr)'; // мобильный: просто по 2 в ряд, рядов может быть больше 2
  } else {
    const cols = Math.max(1, Math.ceil(n / 2));
    wrap.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  }
}
window.addEventListener('resize', () => { if (document.querySelector('.cards')) layoutCardsGrid(); });

function pctChange(cur, prev){
  if(prev == null || !isFinite(prev) || prev === 0) return null;
  if(cur == null || !isFinite(cur)) return null;
  return (cur - prev) / prev * 100;
}
function deltaBadge(cur, prev, opts={}){
  const d = pctChange(cur, prev);
  if(d == null) return '';
  const up = d >= 0;
  const arrow = up ? '▲' : '▼';
  let cls = 'delta-neutral';
  if(!opts.neutral){
    const good = opts.invert ? !up : up;
    cls = good ? 'delta-good' : 'delta-bad';
  }
  return `<span class="delta ${cls}">${arrow} ${Math.abs(d).toFixed(0)}%</span>`;
}

// диапазон дат той же длины, что и текущий, сразу перед его началом.
// для периода "Максимум" сравнивать не с чем — возвращаем пусто.
function previousPeriodDates(currentDates){
  if(!currentDates.length || period === 'max') return [];
  const len = currentDates.length;
  const f = currentDates[0].split('-').map(Number);
  let cur = Date.UTC(f[0], f[1]-1, f[2]) - 86400000;
  const dates = [];
  for(let i=0; i<len; i++){
    dates.unshift(new Date(cur).toISOString().slice(0,10));
    cur -= 86400000;
  }
  return dates;
}

function renderFunnel(impr, clicks, conv){
  const steps = [
    {label:'Показы', value: impr},
    {label:'Клики', value: clicks},
    {label:'Конверсии', value: conv},
  ];
  const max = steps[0].value || 1;
  el('funnel').innerHTML = steps.map((s,i)=>{
    const pct = max ? (s.value/max*100) : 0;
    const rate = i>0 && steps[i-1].value ? (s.value/steps[i-1].value*100) : null;
    return `
      <div class="funnel-step">
        <div class="funnel-row">
          <div class="funnel-label">${s.label}</div>
          <div class="funnel-value">${fmtN(s.value)}</div>
        </div>
        <div class="funnel-bar-wrap"><div class="funnel-bar" style="width:${pct}%"></div></div>
        ${rate!=null ? `<div class="funnel-rate">${rate.toFixed(2)}% от предыдущего шага</div>` : ''}
      </div>`;
  }).join('');
}

function renderWeekdays(rows){
  // 0=Пн ... 6=Вс
  const buckets = Array.from({length:7}, () => ({cost:0, impr:0, conv:0}));
  rows.forEach(r=>{
    const p = r.date.split('-').map(Number);
    const utcDay = new Date(Date.UTC(p[0], p[1]-1, p[2])).getUTCDay(); // 0=Вс..6=Сб
    const idx = (utcDay + 6) % 7; // переводим в 0=Пн..6=Вс
    buckets[idx].cost += r.cost;
    buckets[idx].impr += r.impr;
    buckets[idx].conv += r.conv;
  });
  const labels = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

  function metricRow(key, label, cls){
    const max = Math.max(...buckets.map(b=>b[key]), 0) || 1;
    return `<div class="wd-metric">
      <div class="wd-metric-label">${label}</div>
      <div class="wd-days">
        ${buckets.map((b,i)=>`
          <div class="wd-day" data-tip="${labels[i]}: ${fmtM(b[key])}">
            <div class="wd-bar ${cls}" style="height:${b[key]/max*100}%"></div>
            <span class="wd-daylabel">${labels[i]}</span>
          </div>`).join('')}
      </div>
    </div>`;
  }

  el('weekdayBreakdown').innerHTML =
    metricRow('cost', 'Расход', 'wd-spend') +
    metricRow('impr', 'Показы', 'wd-impr') +
    metricRow('conv', 'Лиды', 'wd-conv');
}

function renderFormatPanel(){
  const panel = el('formatPanel');
  if(!panel) return;

  const dates = periodDates();
  const set = new Set(dates);
  const rows = FORMATS.filter(f => set.has(f.date) && (account==='__all' || f.client===account));
  if(!rows.length){ panel.classList.add('hidden'); return; }

  const byFmt = {};
  rows.forEach(r=>{
    if(!byFmt[r.format]) byFmt[r.format] = { cost:0, conv:0, impr:0, clicks:0, curs:new Set() };
    byFmt[r.format].cost += r.cost;
    byFmt[r.format].conv += r.conv;
    byFmt[r.format].impr += r.impr;
    byFmt[r.format].clicks += r.clicks;
    if(r.currency) byFmt[r.format].curs.add(r.currency);
  });

  const order = ['Видео','Статика','Карусель','Другое'];
  const fmts = Object.keys(byFmt).sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  if(!fmts.length){ panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');

  el('formatTable').innerHTML = `
    <table class="fmt-table">
      <thead><tr><th>Формат</th><th>Расход</th><th>Показы</th><th>Конверсии</th><th>CPA</th></tr></thead>
      <tbody>${fmts.map(f=>{
        const d = byFmt[f];
        const curLabel = d.curs.size===1 ? [...d.curs][0] : '';
        const curSuffix = curLabel ? ' '+sym(curLabel) : '';
        const cpa = d.conv ? fmtM(d.cost/d.conv)+curSuffix : '—';
        return `<tr><td>${esc(f)}</td><td>${fmtM(d.cost)}${curSuffix}</td><td>${fmtN(d.impr)}</td><td>${fmtN(d.conv)}</td><td>${cpa}</td></tr>`;
      }).join('')}</tbody>
    </table>`;
}

function renderChannels(rows, curs){
  const panel = el('channelPanel');
  const platforms = [...new Set(rows.map(r=>r.platform))];
  if(platforms.length < 2){ panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');

  const byPlat = {};
  rows.forEach(r=>{
    byPlat[r.platform] = byPlat[r.platform] || {conv:0, cost:0};
    byPlat[r.platform].conv += r.conv;
    byPlat[r.platform].cost += r.cost;
  });
  const gConv = (byPlat['Google Ads']||{}).conv || 0;
  const mConv = (byPlat['Meta Ads']||{}).conv || 0;
  const gCost = (byPlat['Google Ads']||{}).cost || 0;
  const mCost = (byPlat['Meta Ads']||{}).cost || 0;
  const totalConv = gConv + mConv;
  const totalCost = gCost + mCost;

  function splitBar(g, m, total){
    const pg = total ? g/total*100 : 50;
    return `<div class="chan-split"><div class="seg-google" style="width:${pg}%"></div><div class="seg-meta" style="width:${100-pg}%"></div></div>`;
  }

  let html = `<div class="chan-block">
    <div class="chan-legend"><span>Google: <b>${fmtM(gConv)}</b></span><span>Meta: <b>${fmtM(mConv)}</b></span></div>
    ${splitBar(gConv, mConv, totalConv)}
    <div class="chan-caption">Доля конверсий</div>
  </div>`;

  if(curs.length === 1){
    html += `<div class="chan-block" style="margin-top:16px">
      <div class="chan-legend"><span>Google: <b>${fmtM(gCost)} ${sym(curs[0])}</b></span><span>Meta: <b>${fmtM(mCost)} ${sym(curs[0])}</b></span></div>
      ${splitBar(gCost, mCost, totalCost)}
      <div class="chan-caption">Доля расхода</div>
    </div>`;
  }
  el('channelBreakdown').innerHTML = html;
}

function drawInsights(){
  const panel = el('insightsPanel');
  if(!INSIGHTS.length){ panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  el('insightsList').innerHTML = INSIGHTS.map(i=>`
    <div class="insight">
      <div class="when">${esc(i.periodLabel || i.date)}
        ${i.status==='draft' ? '<span class="draft">черновик AI</span>' : ''}</div>
      ${i.insight ? `<p><b>Вывод:</b> ${esc(i.insight)}</p>` : ''}
      ${i.plan ? `<p><b>План:</b> ${esc(i.plan)}</p>` : ''}
    </div>`).join('');
}

function drawChart(dates, rows, curs){
  if(chartMode === 'efficiency') return drawEfficiencyChart(dates, rows, curs);
  return drawVolumeChart(dates, rows, curs);
}

function drawVolumeChart(dates, rows, curs){
  const convByDay = dates.map(d => rows.filter(r=>r.date===d).reduce((s,r)=>s+r.conv,0));
  const palette = ['#25ddcc','#8f7bff','#ffb454','#ff6b81'];
  const spendSets = curs.map((c,i)=>({
    type:'line', label:'Расход, '+c, yAxisID:'y1',
    data: dates.map(d => rows.filter(r=>r.date===d && r.currency===c).reduce((s,r)=>s+r.cost,0)),
    borderColor: palette[i] || '#aaa', backgroundColor:'transparent',
    tension:.3, pointRadius:2, borderWidth:2,
  }));
  const cfg = {
    data:{ labels: dates.map(d=>d.slice(5)), datasets:[
      {type:'bar', label:'Конверсии', yAxisID:'y2', data:convByDay,
       backgroundColor:'rgba(255,255,255,.10)', borderRadius:4},
      ...spendSets ]},
    options:{ responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{labels:{color:'#87878f',font:{family:'Golos Text',size:12},boxWidth:12}}},
      scales:{
        x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#87878f',font:{family:'Golos Text',size:11}}},
        y1:{position:'left',grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#87878f',font:{family:'Golos Text',size:11}}},
        y2:{position:'right',grid:{display:false},ticks:{color:'#87878f',font:{family:'Golos Text',size:11}}}
      }}};
  if(chart) chart.destroy();
  chart = new Chart(el('chart'), cfg);
}

function drawEfficiencyChart(dates, rows, curs){
  const palette = ['#25ddcc','#8f7bff','#ffb454','#ff6b81'];
  const cpaSets = curs.map((c,i)=>({
    type:'line', label:'CPA, '+c, yAxisID:'y1',
    data: dates.map(d=>{
      const dayRows = rows.filter(r=>r.date===d && r.currency===c);
      const cost = dayRows.reduce((s,r)=>s+r.cost,0);
      const conv = dayRows.reduce((s,r)=>s+r.conv,0);
      return conv ? +(cost/conv).toFixed(2) : null;
    }),
    borderColor: palette[i] || '#aaa', backgroundColor:'transparent',
    tension:.3, pointRadius:2, borderWidth:2, spanGaps:true,
  }));
  const ctrByDay = dates.map(d=>{
    const dayRows = rows.filter(r=>r.date===d);
    const impr = dayRows.reduce((s,r)=>s+r.impr,0);
    const clicks = dayRows.reduce((s,r)=>s+r.clicks,0);
    return impr ? +(clicks/impr*100).toFixed(2) : 0;
  });
  const cfg = {
    data:{ labels: dates.map(d=>d.slice(5)), datasets:[
      {type:'bar', label:'CTR, %', yAxisID:'y2', data:ctrByDay,
       backgroundColor:'rgba(255,255,255,.10)', borderRadius:4},
      ...cpaSets ]},
    options:{ responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{labels:{color:'#87878f',font:{family:'Golos Text',size:12},boxWidth:12}}},
      scales:{
        x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#87878f',font:{family:'Golos Text',size:11}}},
        y1:{position:'left',grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#87878f',font:{family:'Golos Text',size:11}}},
        y2:{position:'right',grid:{display:false},ticks:{color:'#87878f',font:{family:'Golos Text',size:11},callback:v=>v+'%'}}
      }}};
  if(chart) chart.destroy();
  chart = new Chart(el('chart'), cfg);
}

function drawTable(rows){
  const agg = {};
  rows.forEach(r=>{
    const k = r.account+'||'+r.campaign+'||'+r.currency+'||'+r.platform;
    agg[k] = agg[k] || {account:r.account,campaign:r.campaign,currency:r.currency,platform:r.platform,impr:0,clicks:0,cost:0,conv:0};
    agg[k].impr+=r.impr; agg[k].clicks+=r.clicks; agg[k].cost+=r.cost; agg[k].conv+=r.conv;
  });
  const list = Object.values(agg).sort((a,b)=>b.cost-a.cost);

  // группируем по аккаунту — имя аккаунта не повторяем на каждой кампании
  const groups = [];
  const seen = {};
  list.forEach(r=>{
    if(!seen[r.account]){ seen[r.account] = {account:r.account, items:[]}; groups.push(seen[r.account]); }
    seen[r.account].items.push(r);
  });

  el('campList').innerHTML = groups.map(g => `
    <div class="task-group">
      ${groups.length > 1 ? `<div class="task-group-title">${esc(g.account)}</div>` : ''}
      ${g.items.map(r => `
        <div class="camp-row">
          <div class="camp-head">
            <span class="camp-name" title="${esc(r.campaign)}">${esc(r.campaign)}</span>
            <span class="chan-tag ${r.platform==='Meta Ads'?'meta':'google'}">${r.platform==='Meta Ads'?'Meta':'Google'}</span>
          </div>
          <div class="camp-metrics">
            <div class="m"><span class="mlabel">Показы</span><span class="mval">${fmtN(r.impr)}</span></div>
            <div class="m"><span class="mlabel">Клики</span><span class="mval">${fmtN(r.clicks)}</span></div>
            <div class="m"><span class="mlabel">CTR</span><span class="mval">${r.impr?(r.clicks/r.impr*100).toFixed(2)+'%':'—'}</span></div>
            <div class="m"><span class="mlabel">Расход</span><span class="mval">${fmtM(r.cost)} ${sym(r.currency)}</span></div>
            <div class="m"><span class="mlabel">Конв.</span><span class="mval">${fmtM(r.conv)}</span></div>
            <div class="m"><span class="mlabel">CPA</span><span class="mval">${r.conv?fmtM(r.cost/r.conv)+' '+sym(r.currency):'—'}</span></div>
          </div>
        </div>`).join('')}
    </div>`).join('');
}

function buildAccountSelect(){
  const sel = el('accountSelect');
  const names = [...new Set(DATA.map(r=>r.account))].sort();
  sel.innerHTML = '<option value="__all">Все аккаунты</option>' +
    names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
}

/* ---------- проект ---------- */

const PROJECT_TAB = C.projectTab || 'План работ';
// Стандартный набор доп.вкладок проекта — общий для всех клиентов.
// Если у конкретного клиента вкладки называются иначе, можно переопределить
// через projectExtraTabs в его index.html — но по умолчанию всё берётся отсюда.
const DEFAULT_EXTRA_TABS = [
  { tab: 'ОС по лидам', label: 'ОС по лидам' },
  { tab: 'Еженедельная сводка', label: 'Сводка (неделя)', mode: 'weekly-report' },
  { tab: 'Месячная сводка', label: 'Сводка (месяц)', mode: 'weekly-report' },
  { tab: 'Анализ конкурентов', label: 'Конкуренты', mode: 'competitors' },
  { tab: 'Стратегия', label: 'Стратегия' },
  { tab: 'Креативный бриф', label: 'Креативный бриф', mode: 'creative-brief' },
];
const EXTRA_TABS = C.projectExtraTabs || DEFAULT_EXTRA_TABS;
const genericCache = {};

// список планов-по-каналам — опционально задаётся в конфиге клиента:
// projectPlanTabs: [{tab:'План работы (SMM)', label:'SMM'}, ...]
// Если не задан — поведение точно как раньше: одна вкладка "План работ".
const PLAN_TABS = (C.projectPlanTabs && C.projectPlanTabs.length)
  ? C.projectPlanTabs
  : [{ tab: PROJECT_TAB, label: 'План работ' }];
const planCache = {};

function initProject(){
  const tabs = el('viewTabs');
  tabs.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click',()=>{ activateView(b.dataset.view); updateHash(); });
  });

  if(EXTRA_TABS.length || PLAN_TABS.length > 1){
    const nav = el('projectSubNav');
    nav.classList.remove('hidden');
    nav.innerHTML = PLAN_TABS.map((p,i)=>`<button data-sub="__plan${i}" class="${i===0?'active':''}">${esc(p.label)}</button>`).join('') +
      EXTRA_TABS.map((t,i)=>`<button data-sub="${i}">${esc(t.label)}</button>`).join('');
    nav.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click',()=>{ activateProjectSub(b.dataset.sub); updateHash(); });
    });
  }

  loadPlanTab(PLAN_TABS[0].tab);

  // ссылка вида #project или #project/Название-раздела открывает сразу
  // нужную вкладку — без хэша ведёт себя как раньше (по умолчанию "Показатели")
  applyHashRoute();
  window.addEventListener('hashchange', applyHashRoute);
}

// переключает верхний уровень (Показатели / Проект или Показатели / каналы),
// без побочных эффектов на URL — сам URL обновляет updateHash(), вызываемый
// отдельно из клика и из роутера
function activateView(view){
  const tabs = el('viewTabs');
  tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active', x.dataset.view===view));
  const isMetrics = view === 'metrics';
  el('metricsView').classList.toggle('hidden', !isMetrics);
  el('projectView').classList.toggle('hidden', isMetrics);
}

// грузит один из "план"-листов (обычный План работ, либо один из
// каналов — SMM/Meta/Google и т.д.) в общую секцию planSection.
// Кэшируется по имени листа — переключение туда-обратно не бьёт лишний раз в таблицу.
function loadPlanTab(tabName){
  if(planCache[tabName]){ renderProject(planCache[tabName]); return; }
  // raw=true — не полагаемся на автоопределение шапки Google (см. renderGeneric):
  // на листах с пустой первой колонкой оно иногда сдвигает столбцы, ломая
  // дедлайн/статус. parseProject сама отфильтровывает строку-шапку и
  // строки-разделители по смыслу (пустая задача / нераспознанный статус).
  gvizFrom(C.projectSheetId, tabName,
    j => { const parsed = parseProject(j); planCache[tabName] = parsed; renderProject(parsed); },
    () => { pShow('pError'); }, true);
}

// переключает подвкладку внутри "Проекта" (План работ / каналы / Сводки / Бриф и т.д.)
function activateProjectSub(sub){
  const nav = el('projectSubNav');
  if(!nav) return;
  nav.querySelectorAll('button').forEach(x=>x.classList.toggle('active', x.dataset.sub===sub));
  if(sub.indexOf('__plan') === 0){
    el('planSection').classList.remove('hidden');
    el('genericSection').classList.add('hidden');
    const idx = +sub.slice(6) || 0; // "__plan" -> 0, "__plan2" -> 2
    if(PLAN_TABS[idx]) loadPlanTab(PLAN_TABS[idx].tab);
  } else {
    el('planSection').classList.add('hidden');
    el('genericSection').classList.remove('hidden');
    if(EXTRA_TABS[+sub]) loadGenericTab(EXTRA_TABS[+sub]);
  }
}

// текущее состояние вкладок -> #project или #project/Название-раздела.
// Работает для любой подвкладки (план-канал или общая) по её видимой подписи,
// а не только для списка EXTRA_TABS.
function updateHash(){
  const isProject = !el('projectView').classList.contains('hidden');
  if(!isProject){ history.replaceState(null, '', '#metrics'); return; }
  const nav = el('projectSubNav');
  const activeBtn = nav && nav.querySelector('button.active');
  if(!activeBtn){ history.replaceState(null, '', '#project'); return; }
  const isSinglePlan = activeBtn.dataset.sub === '__plan0' && PLAN_TABS.length === 1;
  if(isSinglePlan){ history.replaceState(null, '', '#project'); return; }
  history.replaceState(null, '', '#project/' + encodeURIComponent(activeBtn.textContent.trim()));
}

// разбирает текущий #хэш и ставит дашборд в нужное состояние —
// вызывается один раз при загрузке и при любом ручном изменении хэша
function applyHashRoute(){
  const raw = location.hash.replace(/^#/, '');
  if(!raw) return; // без хэша — поведение по умолчанию (Показатели)
  const [view, subRaw] = raw.split('/');
  if(view !== 'project') return; // 'metrics' и так активна по умолчанию

  activateView('project');
  if(subRaw){
    const label = decodeURIComponent(subRaw);
    const nav = el('projectSubNav');
    const btn = nav && Array.from(nav.querySelectorAll('button')).find(b => b.textContent.trim() === label);
    if(btn) activateProjectSub(btn.dataset.sub);
  }
}

/* ---------- проект по каналам (SMM/Meta/Google и т.п.) ----------
   Отдельная от initProject()/activateProjectSub() ветка — включается,
   только если у клиента задан projectChannels. Переиспользует без
   изменений loadPlanTab/loadGenericTab/renderGenericByMode и их кэши —
   имена листов уже уникальны между каналами (несут суффикс канала). */

let activeChannel = null;

// по "базовому" имени листа (без суффикса канала) — как его рендерить.
// Неизвестные имена (новые листы вроде "Контент-план") просто попадают
// в обычную таблицу — renderGeneric.
const CHANNEL_TAB_MODES = {
  'План работы':        { kind: 'plan' },
  'План работ':          { kind: 'plan' },
  'Еженедельная сводка': { mode: 'weekly-report' },
  'Месячная сводка':     { mode: 'weekly-report' },
  'Анализ конкурентов':  { mode: 'competitors' },
  'Креативный бриф':     { mode: 'creative-brief' },
};

// строит список под-вкладок канала из РЕАЛЬНОГО списка листов таблицы —
// берёт только те, чьё имя оканчивается на " (Label)" этого канала
// (например "Контент-план (SMM)" -> канал SMM, подпись "Контент-план")
function buildChannelTabs(sheetTitles, label){
  const suffix = ' (' + label + ')';
  return sheetTitles
    .filter(t => t.endsWith(suffix))
    .map(t => {
      const base = t.slice(0, -suffix.length);
      return Object.assign({ tab: t, label: base }, CHANNEL_TAB_MODES[base] || {});
    })
    // "План работы" всегда первой вкладкой, остальное — как в самой таблице
    .sort((a, b) => (b.kind === 'plan') - (a.kind === 'plan'));
}

// спрашивает у Google Sheets API реальный список листов таблицы (нужен
// C.projectApiKey — публичный ключ, ограниченный по домену и Sheets API)
// и раскладывает их по каналам согласно суффиксу "(Label)" в имени листа
function discoverChannelTabs(done){
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${C.projectSheetId}` +
    `?key=${encodeURIComponent(C.projectApiKey)}&fields=sheets.properties.title`;
  fetch(url).then(r => r.json()).then(json => {
    const titles = ((json.sheets) || []).map(s => s.properties.title);
    CHANNELS.forEach(ch => { ch.tabs = buildChannelTabs(titles, ch.label); });
    done();
  }).catch(() => done());
}

function initChannels(){
  const bootReady = () => {
    const tabs = el('viewTabs');
    tabs.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click',()=>{
        activateView(b.dataset.view);
        if(b.dataset.view !== 'metrics') activateChannel(b.dataset.view);
        updateChannelHash();
      });
    });

    // ссылка вида #smm или #smm/Название-раздела открывает сразу нужный
    // канал+раздел — без хэша ведёт себя как раньше (по умолчанию "Показатели")
    applyChannelHashRoute();
    window.addEventListener('hashchange', applyChannelHashRoute);
  };

  // список под-вкладок каждого канала либо уже задан статично в конфиге
  // (C.projectChannels[i].tabs), либо — если указан projectApiKey —
  // выясняется на лету из реального списка листов таблицы
  if(C.projectApiKey) discoverChannelTabs(bootReady);
  else bootReady();
}

// переключает активный канал и перестраивает под-вкладки проекта под него
function activateChannel(key){
  const ch = CHANNELS.find(c => c.key === key);
  if(!ch) return;
  activeChannel = ch;
  const nav = el('projectSubNav');
  nav.classList.remove('hidden');
  const chTabs = ch.tabs || [];
  if(!chTabs.length){
    nav.innerHTML = '';
    el('planSection').classList.add('hidden');
    el('genericSection').classList.remove('hidden');
    gShow('gError');
    return;
  }
  nav.innerHTML = chTabs.map((t,i)=>`<button data-sub="${i}" class="${i===0?'active':''}">${esc(t.label)}</button>`).join('');
  nav.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click',()=>{ activateChannelSub(+b.dataset.sub); updateChannelHash(); });
  });
  activateChannelSub(0);
}

// переключает под-вкладку внутри активного канала
function activateChannelSub(idx){
  if(!activeChannel) return;
  const tabDef = activeChannel.tabs[idx];
  if(!tabDef) return;
  el('projectSubNav').querySelectorAll('button').forEach((x,i)=>x.classList.toggle('active', i===idx));
  const isPlan = tabDef.kind === 'plan';
  el('planSection').classList.toggle('hidden', !isPlan);
  el('genericSection').classList.toggle('hidden', isPlan);
  if(isPlan) loadPlanTab(tabDef.tab); else loadGenericTab(tabDef);
}

// текущее состояние вкладок -> #metrics, #<канал> или #<канал>/Название-раздела
function updateChannelHash(){
  const activeBtn = el('viewTabs').querySelector('button.active');
  const view = activeBtn ? activeBtn.dataset.view : 'metrics';
  if(view === 'metrics'){ history.replaceState(null, '', '#metrics'); return; }
  const subBtn = el('projectSubNav').querySelector('button.active');
  if(!subBtn){ history.replaceState(null, '', '#' + view); return; }
  history.replaceState(null, '', '#' + view + '/' + encodeURIComponent(subBtn.textContent.trim()));
}

// разбирает текущий #хэш и ставит дашборд в нужное состояние —
// вызывается один раз при загрузке и при любом ручном изменении хэша
function applyChannelHashRoute(){
  const raw = location.hash.replace(/^#/, '');
  if(!raw) return; // без хэша — поведение по умолчанию (Показатели)
  const [view, subRaw] = raw.split('/');
  const ch = CHANNELS.find(c => c.key === view);
  if(!ch) return; // 'metrics' и так активна по умолчанию

  activateView(view);
  activateChannel(view);
  if(subRaw && ch.tabs && ch.tabs.length){
    const label = decodeURIComponent(subRaw);
    const idx = ch.tabs.findIndex(t => t.label === label);
    if(idx >= 0) activateChannelSub(idx);
  }
}

// показывает произвольную вкладку таблицы. Три режима:
// 'table' (по умолчанию) — шапка+строки как есть
// 'weekly-report' — повторяющиеся блоки период/таблица/итого/заметки
// 'competitors' — карточки конкурентов из атрибутных блоков
function loadGenericTab(tabDef){
  gShow('gLoading');
  el('gTitle').textContent = tabDef.label;

  if(genericCache[tabDef.tab]){ renderGenericByMode(tabDef, genericCache[tabDef.tab]); return; }

  // обычная таблица (без спецрежима) сама ищет свою шапку — остальные
  // режимы (weekly-report/competitors/creative-brief) полагаются на
  // автоопределение Google как и раньше, их не трогаем
  gvizFrom(C.projectSheetId, tabDef.tab,
    j => { genericCache[tabDef.tab] = j; renderGenericByMode(tabDef, j); },
    () => gShow('gError'), !tabDef.mode);
}

function renderGenericByMode(tabDef, json){
  try{
    if(tabDef.mode === 'weekly-report') return renderWeeklyReport(json, tabDef.tab);
    if(tabDef.mode === 'competitors') return renderCompetitors(json);
    if(tabDef.mode === 'creative-brief') return renderCreativeBrief(json);
    return renderGeneric(json);
  }catch(e){
    gShow('gError');
  }
}

// достаёт "сырое" значение ячейки — отформатированное (f) если есть, иначе значение (v)
function rawCell(c){
  if(!c) return '';
  if(c.f != null) return String(c.f);
  if(c.v != null) return String(c.v);
  return '';
}
function rawRow(r){ return (r.c || []).map(rawCell); }

/* ---------- еженедельная/месячная сводка: период -> таблица -> итого -> заметки ---------- */

function renderWeeklyReport(json, tabName){
  const rows = ((json.table && json.table.rows) || []).map(rawRow);

  // ищем ВСЕ шапки таблиц по периодам. Разные отчёты бывают на уровне
  // кампаний ("Campaign Name") или на уровне групп объявлений
  // ("Ad Set Name") — ловим оба варианта, дальше нам всё равно нужен
  // только текст заметок внутри блока, не сама таблица метрик.
  const headerIdxs = [];
  for(let i = 0; i < rows.length; i++){
    if(rows[i].some(v => v.trim() === 'Campaign Name' || v.trim() === 'Ad Set Name')) headerIdxs.push(i);
  }
  if(!headerIdxs.length){ gShow('gError'); return; }

  const blocks = [];
  for(let h = 0; h < headerIdxs.length; h++){
    const start = headerIdxs[h];
    const end = h+1 < headerIdxs.length ? headerIdxs[h+1] : rows.length;

    // заголовок периода — одиночная непустая ячейка в паре строк выше шапки
    let title = 'Период';
    for(let back = start-1; back >= Math.max(0, start-4); back--){
      const nonEmpty = rows[back].map(v=>v.trim()).filter(Boolean);
      if(nonEmpty.length === 1){ title = nonEmpty[0]; break; }
      if(nonEmpty.length > 1) break; // это уже не заголовок периода
    }

    // заметки — самый длинный текст внутри блока (реальный абзац всегда
    // на порядок длиннее любого названия кампании)
    let notes = '', bestLen = 0;
    for(let k = start+1; k < end; k++){
      for(const v of rows[k]){
        const t = v.trim();
        if(t.length > bestLen){ bestLen = t.length; notes = t; }
      }
    }
    if(bestLen >= 60) blocks.push({title, notes});
  }

  if(!blocks.length){ gShow('gError'); return; }

  // необязательный крючок для клиент-специфичных блоков (например,
  // воронка CRM у MyPulse) — только на вкладке "Еженедельная сводка",
  // не на "Месячная сводка" (они делят один и тот же рендер)
  const pluginHtml = (tabName === 'Еженедельная сводка' && typeof window.renderWeeklyReportExtra === 'function')
    ? (window.renderWeeklyReportExtra(json, headerIdxs[0]) || '') : '';

  el('gWrap').innerHTML = pluginHtml + blocks.map(b => `
    <div class="wk-block">
      <div class="wk-title">${esc(b.title)}</div>
      <div class="wk-notes">${linkify(b.notes).split('\n').filter(Boolean).map(l=>`<p>${l}</p>`).join('')}</div>
    </div>`).join('');
  gShow('gPanel');
}

/* ---------- креативный бриф: секции (Статика/Видео) -> карточки идей ---------- */

function renderCreativeBrief(json){
  const cols = (json.table && json.table.cols) || [];
  const rows = ((json.table && json.table.rows) || []).map(rawRow);

  const groups = [];
  // Google Sheets иногда утаскивает самую первую метку раздела в подпись
  // колонки A (это видно по parsedNumHeaders > 1) — восстанавливаем её оттуда
  const firstLabel = (cols[0] && cols[0].label || '').trim();
  let current = null;
  if(firstLabel && !/^(топик|campaign|гипотез|анализ)/i.test(firstLabel)){
    current = {name: firstLabel, items: []};
    groups.push(current);
  }

  for(const r of rows){
    const label = (r[0]||'').trim();
    const hyp = (r[1]||'').trim();
    const restEmpty = r.slice(1).every(v => !v.trim());

    if(label && restEmpty){ current = {name: label, items: []}; groups.push(current); continue; }
    if(!hyp) continue; // пустая строка-разделитель
    if(!current){ current = {name: '', items: []}; groups.push(current); }

    current.items.push({
      label,
      hypothesis: hyp,
      reference: (r[2]||'').trim(),
      count: (r[3]||'').trim(),
      audience: (r[4]||'').trim(),
      statusTeam: (r[5]||'').trim(),
      statusClient: (r[6]||'').trim(),
    });
  }

  const filled = groups.filter(g => g.items.length);
  if(!filled.length){ gShow('gError'); return; }

  el('gWrap').innerHTML = filled.map(g => `
    <div class="task-group">
      ${g.name ? `<div class="task-group-title">${esc(g.name)}</div>` : ''}
      ${g.items.map(it => `
        <div class="cb-card">
          ${it.label ? `<div class="cb-label">${esc(it.label)}</div>` : ''}
          <div class="cb-hyp">${linkify(it.hypothesis)}</div>
          <div class="cb-meta">
            ${it.reference ? `<span>Референс: ${linkify(it.reference)}</span>` : ''}
            ${it.count ? `<span>Креативов: ${esc(it.count)}</span>` : ''}
          </div>
          ${it.audience ? `<div class="cb-audience">${esc(it.audience)}</div>` : ''}
          ${(it.statusTeam || it.statusClient) ? `<div class="cb-status">
            ${it.statusTeam ? `<span class="badge b-plan">Команда: ${esc(it.statusTeam)}</span>` : ''}
            ${it.statusClient ? `<span class="badge b-plan">Клиент: ${esc(it.statusClient)}</span>` : ''}
          </div>` : ''}
        </div>`).join('')}
    </div>`).join('');
  gShow('gPanel');
}

function renderCompetitors(json){
  const rows = ((json.table && json.table.rows) || []).map(rawRow);
  const cards = [];
  let summary = '';
  let i = 0;

  while(i < rows.length){
    if((rows[i][1]||'').trim() === 'Анализ'){
      i++;
      if(i >= rows.length) break;
      const label = (rows[i][0]||'').trim() || `Конкурент ${cards.length+1}`;
      const items = [];
      while(i < rows.length && (rows[i][1]||'').trim() && (rows[i][1]||'').trim() !== 'Анализ'){
        items.push({
          attr: rows[i][1].trim(),
          result: (rows[i][4]||'').trim(),
          notes: (rows[i][8]||'').trim(),
        });
        i++;
      }
      cards.push({label, items});
      continue;
    }
    // общий вывод в конце документа
    if(/общие выводы/i.test(rows[i][0]||'')){
      const parts = [];
      let k = i+1;
      for(; k < rows.length; k++){
        const cell = rows[k].find(v=>v.trim().length>20);
        if(cell) parts.push(cell); else if(parts.length) break;
      }
      summary = parts.join('\n');
      i = k;
      continue;
    }
    i++;
  }

  if(!cards.length){ gShow('gError'); return; }

  el('gWrap').innerHTML =
    cards.map(c => `
      <div class="comp-card">
        <div class="comp-title">${esc(c.label)}</div>
        ${c.items.map(it => `
          <div class="comp-row">
            <div class="comp-attr">${esc(it.attr)}</div>
            <div class="comp-result">${linkify(it.result)}</div>
            ${it.notes ? `<div class="comp-notes">${linkify(it.notes)}</div>` : ''}
          </div>`).join('')}
      </div>`).join('') +
    (summary ? `<div class="comp-summary"><div class="wk-title">Общие выводы</div>
      ${summary.split('\n').filter(Boolean).map(l=>`<p>${linkify(l)}</p>`).join('')}</div>` : '');
  gShow('gPanel');
}

// запрошен с headers=0 (см. gvizFrom) — Google отдаёт все строки как есть,
// без попытки самому угадать шапку, поэтому шапку ищем сами: первая строка
// хотя бы с одной заполненной ячейкой (некоторые листы держат пустую первую
// строку и/или начинают данные не с колонки A)
function renderGeneric(json){
  const allRows = ((json.table && json.table.rows) || []).map(rawRow);
  const headerIdx = allRows.findIndex(r => r.some(v => v.trim()));
  if(headerIdx === -1){ gShow('gError'); return; }

  const header = allRows[headerIdx];
  const idxs = header.map((v,i)=> v.trim() ? i : -1).filter(i=>i!==-1);
  const rows = allRows.slice(headerIdx + 1).filter(r => idxs.some(i => (r[i]||'').trim()));
  if(!rows.length){ gShow('gError'); return; }

  // ширина колонок — по содержимому, а не поровну: короткая подпись вроде
  // "Направление" не должна растягиваться на треть таблицы, если рядом
  // колонка с абзацами текста
  const weights = idxs.map(i => Math.min(
    Math.max(header[i].length, ...rows.map(r => (r[i]||'').length)), 80));
  const totalW = weights.reduce((a,b)=>a+b, 0) || 1;
  const minPct = 16;
  const rawPct = weights.map(w => Math.max(minPct, w / totalW * 100));
  const scale = 100 / rawPct.reduce((a,b)=>a+b, 0);
  const colgroup = '<colgroup>' + rawPct.map(p=>`<col style="width:${(p*scale).toFixed(2)}%">`).join('') + '</colgroup>';

  const thead = '<thead><tr>' + idxs.map(i=>`<th>${esc(header[i])}</th>`).join('') + '</tr></thead>';
  const tbody = '<tbody>' + rows.map(r =>
    '<tr>' + idxs.map(i=>`<td data-label="${esc(header[i])}">${linkify(r[i]||'')}</td>`).join('') + '</tr>'
  ).join('') + '</tbody>';

  el('gWrap').innerHTML = `<div class="table-wrap"><table>${colgroup}${thead}${tbody}</table></div>`;
  gShow('gPanel');
}

function gShow(id){
  ['gLoading','gError','gPanel'].forEach(x=>
    el(x).classList.toggle('hidden', x!==id));
}

function normStatus(s){
  const t = String(s||'').toLowerCase().trim();
  if(t.startsWith('готов')) return 'done';
  if(t.startsWith('в процесс')) return 'progress';
  if(t.startsWith('план')) return 'plan';
  if(t.startsWith('не исполь')) return 'na';
  return '';
}
const STATUS_LABEL = {done:'Готово', progress:'В процессе', plan:'План', na:'Не используется'};

function parseProject(json){
  const rows = (json && json.table && json.table.rows) || [];
  const out = [];
  let topic = '';
  for(const r of rows){
    const c = r.c || [];
    const t = str(c[0]).trim();
    const task = str(c[1]).trim();
    if(t) topic = t;
    if(!task) continue;                       // пустые строки-разделители
    const status = normStatus(str(c[4]));
    if(!status) continue;
    out.push({
      topic, task,
      deadline: c[2] && c[2].f ? c[2].f : str(c[2]).trim(),
      owner: str(c[3]).trim(),
      status,
      comment: str(c[6]).trim(),
    });
  }
  return out;
}

function renderProject(tasks){
  if(!tasks.length){ pShow('pError'); return; }
  pShow('pContent');

  // прогресс: "Не используется" не считаем ни в числитель, ни в знаменатель
  const counted = tasks.filter(t=>t.status!=='na');
  const doneAll = counted.filter(t=>t.status==='done').length;
  const pctAll = counted.length ? Math.round(doneAll/counted.length*100) : 0;
  el('pTotalFill').style.width = pctAll + '%';
  el('pTotalPct').textContent = pctAll + '%';

  // по этапам
  const topics = [];
  const seen = {};
  counted.forEach(t=>{
    if(!seen[t.topic]){ seen[t.topic] = {name:t.topic, done:0, total:0}; topics.push(seen[t.topic]); }
    seen[t.topic].total++;
    if(t.status==='done') seen[t.topic].done++;
  });
  el('pTopics').innerHTML = topics.map(t=>{
    const p = t.total ? Math.round(t.done/t.total*100) : 0;
    return `<div class="ptopic">
      <div class="tname">${esc(t.name)}</div>
      <div class="pbar"><div class="pfill" style="width:${p}%"></div></div>
      <div class="tcount">${t.done}/${t.total}</div>
    </div>`;
  }).join('');

  // ждём от клиента: не готовые задачи с ответственным Client
  const wait = tasks.filter(t =>
    t.status !== 'done' && t.status !== 'na' &&
    /client|клиент/i.test(t.owner));
  const wp = el('pWaitPanel');
  if(wait.length){
    wp.classList.remove('hidden');
    el('pWaitList').innerHTML = wait.map(t=>`
      <div class="wait">
        <div class="wtask">${esc(t.task)}</div>
        <div class="wmeta">${esc(t.topic)}${t.deadline ? ' · до ' + esc(t.deadline) : ''}${t.comment ? ' · ' + esc(t.comment) : ''}</div>
      </div>`).join('');
  } else {
    wp.classList.add('hidden');
  }

  // все задачи
  // все задачи, сгруппированные по этапу — название этапа не повторяем на каждой строке
  const groups = [];
  const gseen = {};
  tasks.forEach(t=>{
    if(!gseen[t.topic]){ gseen[t.topic] = {topic:t.topic, items:[]}; groups.push(gseen[t.topic]); }
    gseen[t.topic].items.push(t);
  });
  el('pTaskList').innerHTML = groups.map(g => `
    <div class="task-group">
      <div class="task-group-title">${esc(g.topic)}</div>
      ${g.items.map(t => `
        <div class="task-row">
          <div class="task-main">
            <div class="task-name">${esc(t.task)}</div>
            <div class="task-meta">${t.deadline ? 'до ' + esc(t.deadline) : ''}${t.deadline && t.owner ? ' · ' : ''}${esc(t.owner)}</div>
          </div>
          <span class="badge b-${t.status}">${STATUS_LABEL[t.status]}</span>
        </div>`).join('')}
    </div>`).join('');
}

function pShow(id){
  ['pLoading','pError','pContent'].forEach(x=>
    el(x).classList.toggle('hidden', x!==id));
}

function show(id){
  ['loading','errorState','emptyState','content'].forEach(x=>
    el(x).classList.toggle('hidden', x!==id));
}
function el(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

// экранирует текст и превращает http(s)-ссылки внутри в кликабельные
function linkify(raw){
  return esc(raw).replace(/https?:\/\/\S+/g, m => {
    const trail = m.match(/[),.;:!?]+$/);
    const clean = trail ? m.slice(0, -trail[0].length) : m;
    const punct = trail ? trail[0] : '';
    return `<a href="${clean}" target="_blank" rel="noopener">${clean}</a>${punct}`;
  });
}
})();
