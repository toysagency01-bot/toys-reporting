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
.seg{display:flex;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.seg button{background:none;border:none;color:var(--muted);cursor:pointer;padding:10px 16px;
font:500 14px 'Golos Text',sans-serif}
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
@media (prefers-reduced-motion:no-preference){
.card,.panel{animation:rise .35s ease both}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}
</style>`);

/* ---------- markup ---------- */
document.body.innerHTML = `
<header>
  <div class="logo">TOYS<b>.</b></div>
  <div class="sub">${esc(TITLE)}</div>
  <div class="updated" id="updated"></div>
</header>
<div class="controls hidden" id="controls">
  ${LOCKED ? '' : '<select id="accountSelect" aria-label="Аккаунт"></select>'}
  <div class="seg hidden" role="group" aria-label="Канал" id="platformSeg">
    <button data-platform="__all" class="active">Все каналы</button>
    <button data-platform="Google Ads">Google</button>
    <button data-platform="Meta Ads">Meta</button>
  </div>
  <div class="seg" role="group" aria-label="Период">
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
    <div class="table-wrap"><table>
      <thead><tr><th>Аккаунт</th><th>Кампания</th><th>Канал</th><th>Показы</th><th>Клики</th>
      <th>CTR</th><th>Расход</th><th>Конв.</th><th>CPA</th></tr></thead>
      <tbody id="tbody"></tbody>
    </table></div>
  </div>
</div>`;

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
  document.querySelectorAll('.seg button').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('.seg button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); period = +b.dataset.days; render();
    });
  });
  const sel = document.getElementById('accountSelect');
  if(sel) sel.addEventListener('change', e=>{ account = e.target.value; render(); });
  const last = DATA.reduce((m,r)=> r.date>m? r.date:m, '');
  document.getElementById('updated').textContent = 'данные по ' + last;
  render();
}

/* ---------- загрузка (JSONP: работает с file:// и с хостинга) ---------- */
let cbSeq = 0;
function gviz(sheetName, ok, fail){
  const cb = '__gvizCb' + (++cbSeq);
  const timer = setTimeout(()=>{ cleanup(); fail(); }, 12000);
  window[cb] = json => {
    cleanup();
    if(json && json.status === 'error') fail(); else ok(json);
  };
  const s = document.createElement('script');
  s.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler%3A${cb}&sheet=${encodeURIComponent(sheetName)}`;
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
  el('tbody').innerHTML = Object.values(agg).sort((a,b)=>b.cost-a.cost).map(r=>`
    <tr><td>${esc(r.account)}</td>
    <td class="camp" title="${esc(r.campaign)}">${esc(r.campaign)}</td>
    <td>${r.platform==='Meta Ads'?'Meta':'Google'}</td>
    <td>${fmtN(r.impr)}</td><td>${fmtN(r.clicks)}</td>
    <td>${r.impr?(r.clicks/r.impr*100).toFixed(2)+'%':'—'}</td>
    <td>${fmtM(r.cost)} ${sym(r.currency)}</td><td>${fmtM(r.conv)}</td>
    <td>${r.conv?fmtM(r.cost/r.conv)+' '+sym(r.currency):'—'}</td></tr>`).join('');
}

function buildAccountSelect(){
  const sel = el('accountSelect');
  const names = [...new Set(DATA.map(r=>r.account))].sort();
  sel.innerHTML = '<option value="__all">Все аккаунты</option>' +
    names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
}

function show(id){
  ['loading','errorState','emptyState','content'].forEach(x=>
    el(x).classList.toggle('hidden', x!==id));
}
function el(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
})();
