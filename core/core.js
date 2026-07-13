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
.cards{display:grid;gap:12px;margin-bottom:22px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px 18px 16px}
.card .label{color:var(--muted);font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px}
.card .value{font-size:clamp(20px,2.4vw,28px);font-weight:800;font-variant-numeric:tabular-nums;line-height:1.15}
.card .value small{display:block;font-size:15px;font-weight:600;opacity:.85;margin-top:2px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:20px;margin-bottom:22px}
.panel h2{font-size:14px;font-weight:600;color:var(--muted);margin-bottom:16px;letter-spacing:.04em;text-transform:uppercase}
.chart-wrap{position:relative;height:280px}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:14px;min-width:760px}
th{text-align:right;color:var(--muted);font-weight:500;font-size:12px;letter-spacing:.04em;
text-transform:uppercase;padding:0 12px 12px;border-bottom:1px solid var(--line);white-space:nowrap}
th:first-child,th:nth-child(2){text-align:left}
td{padding:12px;border-bottom:1px solid var(--line);text-align:right;
font-variant-numeric:tabular-nums;white-space:nowrap}
td:first-child,td:nth-child(2){text-align:left}
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
  .table-wrap table{min-width:0}
  .table-wrap thead{display:none}
  .table-wrap tr{display:block;border-bottom:1px solid var(--line);padding:12px 0}
  .table-wrap tr:last-child{border-bottom:none}
  .table-wrap td{display:block;width:auto;text-align:left;border:none;
    padding:3px 0;white-space:normal;word-break:break-word}
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
document.body.innerHTML = `
<header>
  <div class="logo">TOYS<b>.</b></div>
  <div class="sub">${esc(TITLE)}</div>
  <div class="updated" id="updated"></div>
</header>
${HAS_PROJECT ? `
<nav class="tabs" id="viewTabs">
  <button data-view="metrics" class="active">Показатели</button>
  <button data-view="project">Проект</button>
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
  </div>
  <div class="panel hidden" id="insightsPanel">
    <h2>Выводы и план</h2>
    <div id="insightsList"></div>
  </div>
  <div class="panel">
    <h2>Динамика по дням</h2>
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
    <div class="state hidden" id="gError"><b>Не удалось загрузить раздел.</b><br>
    Проверь доступ к проектной таблице.</div>
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

let DATA = [], INSIGHTS = [];
let period = 7, account = '__all', platform = '__all', chart = null;

/* ---------- boot: Chart.js -> данные (оба канала) -> insights ---------- */
loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js', () => {
  let google = null, meta = null, done = 0;
  const finish = () => {
    if (++done < 2) return;
    DATA = [...(google || []), ...(meta || [])];
    if (!DATA.length) { show('errorState'); return; }
    gviz('Insights', j2 => { INSIGHTS = parseInsights(j2); start(); },
         () => { INSIGHTS = []; start(); });
  };
  gviz('GoogleAds', j => { google = parseData(j, 'Google Ads'); finish(); }, finish);
  gviz('MetaAds',  j => { meta   = parseData(j, 'Meta Ads');   finish(); }, finish);
});

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
      b.classList.add('active'); period = +b.dataset.days; render();
    });
  });
  const sel = document.getElementById('accountSelect');
  if(sel) sel.addEventListener('change', e=>{ account = e.target.value; render(); });
  const last = DATA.reduce((m,r)=> r.date>m? r.date:m, '');
  document.getElementById('updated').textContent = 'данные по ' + last;
  render();

  if(HAS_PROJECT) initProject();
}

/* ---------- загрузка (JSONP: работает с file:// и с хостинга) ---------- */
let cbSeq = 0;
function gviz(sheetName, ok, fail){ gvizFrom(SHEET_ID, sheetName, ok, fail); }
function gvizFrom(spreadsheetId, sheetName, ok, fail){
  const cb = '__gvizCb' + (++cbSeq);
  const timer = setTimeout(()=>{ cleanup(); fail(); }, 12000);
  window[cb] = json => {
    cleanup();
    if(json && json.status === 'error') fail(); else ok(json);
  };
  const s = document.createElement('script');
  s.src = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=responseHandler%3A${cb}&sheet=${encodeURIComponent(sheetName)}`;
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
    out.push({
      date: cellDate(c[0]), platform: str(c[1]) || defaultPlatform,
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
  const dates = [];
  const end = new Date(); end.setDate(end.getDate()-1);
  for(let i=period-1;i>=0;i--){
    const d = new Date(end); d.setDate(end.getDate()-i);
    dates.push(d.toISOString().slice(0,10));
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

  el('kSpend').innerHTML = curs.map(c=>`<small>${fmtM(byCur[c])} ${sym(c)}</small>`).join('');
  el('kImpr').textContent = fmtN(impr);
  el('kClicks').textContent = fmtN(clicks);
  el('kCtr').textContent = impr? (clicks/impr*100).toFixed(2)+'%' : '—';
  el('kConv').textContent = fmtM(conv);
  el('kCpa').innerHTML = conv
    ? curs.map(c=>{
        const cc = rows.filter(r=>r.currency===c).reduce((s,r)=>s+r.conv,0);
        return cc? `<small>${fmtM(byCur[c]/cc)} ${sym(c)}</small>` : '';
      }).join('')
    : '—';

  drawInsights();
  drawChart(dates, rows, curs);
  drawTable(rows);
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

function initProject(){
  const tabs = el('viewTabs');
  tabs.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click',()=>{
      tabs.querySelectorAll('button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const isProject = b.dataset.view === 'project';
      el('metricsView').classList.toggle('hidden', isProject);
      el('projectView').classList.toggle('hidden', !isProject);
    });
  });

  if(EXTRA_TABS.length){
    const nav = el('projectSubNav');
    nav.classList.remove('hidden');
    nav.innerHTML = `<button data-sub="__plan" class="active">План работ</button>` +
      EXTRA_TABS.map((t,i)=>`<button data-sub="${i}">${esc(t.label)}</button>`).join('');
    nav.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click',()=>{
        nav.querySelectorAll('button').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        const sub = b.dataset.sub;
        if(sub === '__plan'){
          el('planSection').classList.remove('hidden');
          el('genericSection').classList.add('hidden');
        } else {
          el('planSection').classList.add('hidden');
          el('genericSection').classList.remove('hidden');
          loadGenericTab(EXTRA_TABS[+sub]);
        }
      });
    });
  }

  gvizFrom(C.projectSheetId, PROJECT_TAB,
    j => { renderProject(parseProject(j)); },
    () => { pShow('pError'); });
}

// показывает произвольную вкладку таблицы. Три режима:
// 'table' (по умолчанию) — шапка+строки как есть
// 'weekly-report' — повторяющиеся блоки период/таблица/итого/заметки
// 'competitors' — карточки конкурентов из атрибутных блоков
function loadGenericTab(tabDef){
  gShow('gLoading');
  el('gTitle').textContent = tabDef.label;

  if(genericCache[tabDef.tab]){ renderGenericByMode(tabDef, genericCache[tabDef.tab]); return; }

  gvizFrom(C.projectSheetId, tabDef.tab,
    j => { genericCache[tabDef.tab] = j; renderGenericByMode(tabDef, j); },
    () => gShow('gError'));
}

function renderGenericByMode(tabDef, json){
  try{
    if(tabDef.mode === 'weekly-report') return renderWeeklyReport(json);
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

function renderWeeklyReport(json){
  const rows = ((json.table && json.table.rows) || []).map(rawRow);
  const blocks = [];
  let i = 0;

  while(i < rows.length){
    // ищем строку-шапку таблицы кампаний (ячейка "Campaign Name")
    const colName = rows[i].findIndex(v => v.trim() === 'Campaign Name');
    if(colName === -1){ i++; continue; }

    // заголовок периода — одиночная непустая ячейка в нескольких строках выше
    let title = 'Период';
    for(let back = i-1; back >= Math.max(0, i-6); back--){
      const nonEmpty = rows[back].map(v=>v.trim()).filter(Boolean);
      if(nonEmpty.length === 1){ title = nonEmpty[0]; break; }
    }

    // весь блок — от шапки таблицы до первой полностью пустой строки
    let end = i + 1;
    for(; end < rows.length; end++){
      if(rows[end].every(v => !v.trim())) break;
    }

    // заметки — ищем ячейку с переносом строки (только у абзаца заметок
    // бывают переносы; названия кампаний всегда однострочные, даже длинные)
    let notes = '';
    for(let k = i+1; k < end; k++){
      const cell = rows[k].find(v => v.includes('\n') || v.trim().length > 80);
      if(cell){ notes = cell; break; }
    }

    if(notes) blocks.push({title, notes});
    i = end;
  }

  if(!blocks.length){ gShow('gError'); return; }

  el('gWrap').innerHTML = blocks.map(b => `
    <div class="wk-block">
      <div class="wk-title">${esc(b.title)}</div>
      <div class="wk-notes">${linkify(b.notes).split('\n').filter(Boolean).map(l=>`<p>${l}</p>`).join('')}</div>
    </div>`).join('');
  gShow('gPanel');
}

/* ---------- креативный бриф: секции (Статика/Видео) -> карточки идей ---------- */

function renderCreativeBrief(json){
  const rows = ((json.table && json.table.rows) || []).map(rawRow);
  const headerIdx = rows.findIndex(r => /гипотез/i.test((r[1]||'').trim()));
  if(headerIdx === -1){ gShow('gError'); return; }

  const groups = [];
  let current = null;

  for(let i = headerIdx+1; i < rows.length; i++){
    const r = rows[i];
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

function renderGeneric(json){
  const cols = (json.table && json.table.cols) || [];
  const rows = (json.table && json.table.rows) || [];
  // берём только колонки с заголовком — пустые служебные столбцы пропускаем
  const idxs = cols.map((c,i)=>c.label ? i : -1).filter(i=>i!==-1);
  if(!idxs.length || !rows.length){ gShow('gError'); return; }

  const thead = '<thead><tr>' + idxs.map(i=>`<th>${esc(cols[i].label)}</th>`).join('') + '</tr></thead>';
  const tbody = '<tbody>' + rows.map(r=>{
    const c = r.c || [];
    // пропускаем полностью пустые строки
    if(idxs.every(i => !c[i] || (c[i].f==null && c[i].v==null))) return '';
    return '<tr>' + idxs.map(i=>{
      const cell = c[i];
      const val = cell ? (cell.f != null ? cell.f : (cell.v != null ? cell.v : '')) : '';
      return `<td data-label="${esc(cols[i].label)}">${linkify(String(val))}</td>`;
    }).join('') + '</tr>';
  }).join('') + '</tbody>';

  el('gWrap').innerHTML = `<div class="table-wrap"><table>${thead}${tbody}</table></div>`;
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
