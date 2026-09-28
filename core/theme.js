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
}

root.dataset.theme = storedTheme() || 'dark';

document.head.insertAdjacentHTML('beforeend', `
<style id="toysThemeStyles">
:root{
  color-scheme:dark;
  --chart-muted:#87878f;
  --chart-grid:rgba(255,255,255,.05);
  --chart-bar:rgba(255,255,255,.10);
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
}
body,.card,.panel,.seg,.daterange,.range,.weekly-card,.modal-card,.weekly-modal-card{
  transition:background-color .18s ease,border-color .18s ease,color .18s ease;
}
.theme-actions{margin-left:auto;display:flex;align-items:center;gap:12px}
.theme-actions .updated{margin-left:0!important;width:auto!important}
.theme-toggle{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);
  border-radius:10px;background:var(--panel);color:var(--text);padding:8px 11px;
  font:600 12px 'Golos Text',system-ui,sans-serif;cursor:pointer;white-space:nowrap}
.theme-toggle:hover{border-color:rgba(37,221,204,.45);color:var(--accent)}
.theme-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.theme-toggle span[aria-hidden="true"]{font-size:16px;line-height:1}
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
  .theme-actions{margin-left:auto;gap:8px}
  .theme-actions .updated{display:none}
  .theme-toggle{padding:8px 9px}
  .theme-toggle span:last-child{display:none}
}
</style>`);

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', mountToggle, {once:true});
}else{
  mountToggle();
}
})();
