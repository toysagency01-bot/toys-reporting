(function(){
const STORAGE_KEY = 'toys-dashboard-theme';
const root = document.documentElement;

function storedTheme(){
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : '';
  } catch (_) {
    return '';
  }
}

function currentTheme(){
  return root.dataset.theme === 'light' ? 'light' : 'dark';
}

function updateButton(){
  const button = document.getElementById('toysThemeToggle');
  if(!button) return;
  const light = currentTheme() === 'light';
  button.innerHTML = `<span aria-hidden="true">${light ? '☾' : '☀'}</span><span>${light ? 'Тёмная' : 'Светлая'}</span>`;
  button.setAttribute('aria-label', light ? 'Включить тёмную тему' : 'Включить светлую тему');
  button.title = light ? 'Включить тёмную тему' : 'Включить светлую тему';
}

function applyTheme(value, persist){
  const theme = value === 'light' ? 'light' : 'dark';
  root.dataset.theme = theme;
  if(persist){
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
  }
  updateButton();
  window.dispatchEvent(new CustomEvent('toys-theme-change', {detail:{theme}}));
}

function iconMarkup(kind, className){
  const cls = className || 'platform-icon';
  const common = `class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"`;
  const icons = {
    overview:`<svg ${common}><rect x="3" y="3" width="7" height="7" rx="2" fill="currentColor"/><rect x="14" y="3" width="7" height="7" rx="2" fill="currentColor" opacity=".55"/><rect x="3" y="14" width="7" height="7" rx="2" fill="currentColor" opacity=".55"/><rect x="14" y="14" width="7" height="7" rx="2" fill="currentColor"/></svg>`,
    project:`<svg ${common}><path d="M4 7.5h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 7.5V5.8A2.3 2.3 0 0 1 10.3 3.5h3.4A2.3 2.3 0 0 1 16 5.8v1.7M4 12h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    google:`<svg ${common}><path d="M10.1 4.2a2.5 2.5 0 0 1 4.3 0l6.8 11.9a2.5 2.5 0 0 1-4.3 2.5L10.1 6.7a2.5 2.5 0 0 1 0-2.5Z" fill="#4285F4"/><path d="M10.5 4.9 2.9 18.1a2.5 2.5 0 0 0 4.3 2.5l7.6-13.2a2.5 2.5 0 0 0-4.3-2.5Z" fill="#34A853"/><circle cx="5.1" cy="18.6" r="3.1" fill="#FBBC04"/></svg>`,
    meta:`<svg ${common}><path d="M3.1 15.8C4.8 9.1 7.2 5.5 9.6 5.5c3.4 0 4.6 12.8 8 12.8 2 0 3.3-2.6 3.3-5.5 0-4-1.8-7.3-4.8-7.3-4 0-6.8 12.8-10.6 12.8-2.2 0-3.2-1.5-2.4-2.5Z" fill="none" stroke="#0866FF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    instagram:`<svg ${common}><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#E1306C" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#833AB4" stroke-width="2"/><circle cx="17.4" cy="6.8" r="1.2" fill="#FFB000"/></svg>`,
    youtube:`<svg ${common}><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="#FF0033"/><path d="m10 9 5 3-5 3V9Z" fill="#fff"/></svg>`,
    tiktok:`<svg ${common}><path d="M14.5 4v9.2a4.6 4.6 0 1 1-4-4.6" fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round"/><path d="M14.5 4c.7 2.5 2.2 3.9 4.7 4.2" fill="none" stroke="#25F4EE" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    money:`<svg ${common}><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M14.8 8.8c-.6-.8-1.6-1.2-2.8-1.2-1.6 0-2.8.8-2.8 2s1 1.8 2.8 2.2 2.8 1 2.8 2.3-1.1 2.2-2.9 2.2c-1.3 0-2.5-.5-3.2-1.4M12 5.8v12.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    eye:`<svg ${common}><path d="M2.8 12s3.3-5.3 9.2-5.3 9.2 5.3 9.2 5.3-3.3 5.3-9.2 5.3S2.8 12 2.8 12Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>`,
    click:`<svg ${common}><path d="m6 3 11 8-5.2 1.1L9.5 17 6 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m13.5 14.5 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    trend:`<svg ${common}><path d="M4 17 9 12l3 3 7-8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h4v4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    target:`<svg ${common}><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>`
  };
  return icons[kind] || icons.overview;
}

function platformKind(text){
  const value = String(text || '').trim().toLowerCase();
  if(value.includes('google')) return 'google';
  if(value.includes('meta')) return 'meta';
  if(value.includes('instagram') || value === 'smm') return 'instagram';
  if(value.includes('youtube')) return 'youtube';
  if(value.includes('tiktok')) return 'tiktok';
  if(value.includes('показател') || value.includes('overview')) return 'overview';
  if(value.includes('проект') || value.includes('project')) return 'project';
  return '';
}

function metricKind(text){
  const value = String(text || '').trim().toLowerCase();
  if(/расход|выруч|revenue|spend|roas|cpa|цена/.test(value)) return 'money';
  if(/показ|impression|reach|охват/.test(value)) return 'eye';
  if(/клик|click/.test(value)) return 'click';
  if(/ctr|динамик|rate|aov/.test(value)) return 'trend';
  if(/конверс|лид|обращ|покуп|продаж|квал/.test(value)) return 'target';
  return '';
}

function decorateNode(node, kind, iconClass){
  if(!node || !kind || node.querySelector(':scope > .ui-icon')) return;
  node.classList.add('has-ui-icon');
  node.insertAdjacentHTML('afterbegin', iconMarkup(kind, `ui-icon ${iconClass || ''}`.trim()));
}

function decorateUI(){
  document.querySelectorAll('#viewTabs button,#platformSeg button,#projectSubNav button').forEach(node => {
    decorateNode(node, platformKind(node.textContent), 'platform-icon');
  });
  document.querySelectorAll('.chan-tag,.tag').forEach(node => {
    decorateNode(node, platformKind(node.textContent) || (node.classList.contains('meta') ? 'meta' : 'google'), 'platform-icon');
  });
  document.querySelectorAll('.ecom-channel-title,.task-group-title').forEach(node => {
    decorateNode(node, platformKind(node.textContent), 'platform-icon');
  });
  document.querySelectorAll('.card .label').forEach(node => {
    decorateNode(node, metricKind(node.textContent), 'metric-icon');
  });
}

function mountToggle(){
  const header = document.querySelector('header');
  if(!header || document.getElementById('toysThemeToggle')) return;

  const actions = document.createElement('div');
  actions.className = 'theme-actions';
  const updated = header.querySelector('.updated');
  if(updated){
    updated.parentNode.insertBefore(actions, updated);
    actions.appendChild(updated);
  }else{
    header.appendChild(actions);
  }

  const button = document.createElement('button');
  button.id = 'toysThemeToggle';
  button.className = 'theme-toggle';
  button.type = 'button';
  button.addEventListener('click', () => applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true));
  actions.appendChild(button);
  updateButton();
  decorateUI();
}

root.dataset.theme = storedTheme() || 'dark';

document.head.insertAdjacentHTML('beforeend', `
<style id="toysThemeStyles">
:root{
  color-scheme:dark;
  --chart-muted:#87878f;
  --chart-grid:rgba(255,255,255,.05);
  --chart-bar:rgba(255,255,255,.10);
  --ui-shadow:0 12px 34px rgba(0,0,0,.16);
  --ui-shadow-soft:0 4px 16px rgba(0,0,0,.10);
  --ui-hover:rgba(255,255,255,.025);
}
:root[data-theme="light"]{
  color-scheme:light;
  --bg:#f4f6f8;
  --panel:#ffffff;
  --panel-2:#eef2f5;
  --panel2:#eef2f5;
  --line:rgba(22,25,31,.12);
  --text:#171a20;
  --muted:#68717e;
  --accent:#0c9f93;
  --accent-dim:rgba(12,159,147,.12);
  --chart-muted:#68717e;
  --chart-grid:rgba(22,25,31,.09);
  --chart-bar:rgba(22,25,31,.12);
  --ui-shadow:0 14px 38px rgba(27,32,41,.07);
  --ui-shadow-soft:0 5px 18px rgba(27,32,41,.055);
  --ui-hover:#f8fafb;
}
body,.card,.panel,.seg,.daterange,.range,.weekly-card,.modal-card,.weekly-modal-card{
  transition:background-color .18s ease,border-color .18s ease,color .18s ease;
}
.ui-icon{display:block;width:17px;height:17px;flex:0 0 17px}
.metric-icon{width:15px;height:15px;flex-basis:15px;color:var(--accent)}
.has-ui-icon{display:inline-flex;align-items:center;gap:7px}
html body{max-width:1600px;margin:0 auto;padding-top:22px}
html body header{align-items:center;padding:14px 16px;margin-bottom:18px;border:1px solid var(--line);
  border-radius:16px;background:var(--panel);box-shadow:var(--ui-shadow-soft)}
html body .logo-row img,html body .brand img{height:24px}
html body .sub,html body .project{font-weight:600;color:var(--text);font-size:13px}
.theme-actions{margin-left:auto;display:flex;align-items:center;gap:12px}
.theme-actions .updated{margin-left:0!important;width:auto!important}
.theme-toggle{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);
  border-radius:999px;background:var(--panel-2);color:var(--text);padding:8px 12px;
  font:600 12px 'Golos Text',system-ui,sans-serif;cursor:pointer;white-space:nowrap}
.theme-toggle:hover{border-color:rgba(37,221,204,.45);color:var(--accent)}
.theme-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.theme-toggle span[aria-hidden="true"]{font-size:16px;line-height:1}
html body .tabs{width:max-content;max-width:100%;gap:4px;padding:5px;margin-bottom:18px;
  border:1px solid var(--line);border-radius:14px;background:var(--panel);box-shadow:var(--ui-shadow-soft)}
html body .tabs button{display:flex;align-items:center;gap:7px;border:0!important;border-radius:10px;
  margin:0!important;padding:9px 14px;color:var(--muted)}
html body .tabs button.active{background:var(--accent-dim);color:var(--accent)}
html body .controls{padding:10px;margin-bottom:18px;border:1px solid var(--line);border-radius:16px;
  background:var(--panel);box-shadow:var(--ui-shadow-soft)}
html body .seg,html body .daterange,html body .range{background:var(--panel-2)}
html body .cards{gap:14px;margin-bottom:24px}
html body .card{position:relative;min-height:108px;padding:17px 18px;border-radius:16px;
  box-shadow:var(--ui-shadow-soft);overflow:hidden}
html body .card::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;
  background:linear-gradient(90deg,var(--accent),transparent 72%);opacity:.38}
html body .card:hover{transform:translateY(-1px);border-color:rgba(37,221,204,.28)}
html body .card .label{display:flex;align-items:center;gap:7px;margin-bottom:12px;font-weight:600}
html body .card .value{letter-spacing:-.025em}
html body .panel{border-radius:18px;padding:22px;box-shadow:var(--ui-shadow-soft)}
html body .panel h2{font-size:12px;font-weight:800;letter-spacing:.07em}
html body .ecom-channel-title{font-size:13px;padding:2px 2px 9px}
html body .chan-tag,html body .tag{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;
  border:1px solid transparent}
html body #campList .camp-row,html body .campaign{margin-top:8px;padding:14px 15px;
  border:1px solid var(--line);border-radius:13px;background:var(--panel-2)}
html body #campList .camp-row:hover,html body .campaign:hover{background:var(--ui-hover);border-color:rgba(37,221,204,.24)}
html body .weekly-card{box-shadow:0 1px 0 rgba(0,0,0,.02)}
:root[data-theme="light"] body{background:linear-gradient(180deg,#f8f9f7 0,#f3f6f7 240px,#f4f6f8 100%)}
:root[data-theme="light"] header img[alt="TOYS"]{background:#0a0a0a;border-radius:6px;padding:4px 6px;box-sizing:content-box}
:root[data-theme="light"] .daterange input[type="date"],
:root[data-theme="light"] .range input,
:root[data-theme="light"] .weekly-form input,
:root[data-theme="light"] .weekly-form textarea,
:root[data-theme="light"] .weekly-form select{color-scheme:light}
:root[data-theme="light"] .fade-edge.l::before{background:linear-gradient(to right,rgba(244,246,248,.92),transparent)}
:root[data-theme="light"] .fade-edge.r::before{background:linear-gradient(to left,rgba(244,246,248,.92),transparent)}
:root[data-theme="light"] .weekly-card[open]{background:var(--panel)}
:root[data-theme="light"] .weekly-card summary::after,
:root[data-theme="light"] .weekly-modal-close,
:root[data-theme="light"] .modal-close{background:var(--panel-2);color:var(--text)}
:root[data-theme="light"] .weekly-preview,
:root[data-theme="light"] .weekly-field{color:var(--text)}
:root[data-theme="light"] .weekly-form-modal,
:root[data-theme="light"] .modal{background:rgba(22,25,31,.42)}
:root[data-theme="light"] .weekly-modal-card,
:root[data-theme="light"] .modal-card{box-shadow:0 28px 80px rgba(22,25,31,.22)}
@media(max-width:640px){
  html body{padding-top:12px}
  html body header{padding:11px 12px;border-radius:13px}
  html body .controls{padding:8px;border-radius:13px}
  html body .card{min-height:96px;padding:14px}
  html body .panel{padding:16px;border-radius:15px}
  html body .tabs button{padding:8px 11px}
  .theme-actions{margin-left:auto;gap:8px}
  .theme-actions .updated{display:none}
  .theme-toggle{padding:8px 9px}
  .theme-toggle span:last-child{display:none}
}
</style>`);

let decorationQueued = false;
function scheduleDecoration(){
  if(decorationQueued) return;
  decorationQueued = true;
  requestAnimationFrame(() => {
    decorationQueued = false;
    decorateUI();
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => {
    mountToggle();
    decorateUI();
    new MutationObserver(scheduleDecoration).observe(document.body, {childList:true,subtree:true});
  }, {once:true});
}else{
  mountToggle();
  decorateUI();
  new MutationObserver(scheduleDecoration).observe(document.body, {childList:true,subtree:true});
}
})();
