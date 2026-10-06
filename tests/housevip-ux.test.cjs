const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'housevip-cxp7', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'housevip-cxp7', 'ux-v2.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'housevip-cxp7', 'ux-v2.css'), 'utf8');

function ok(value, message){ if(!value) throw new Error(message); }

ok(html.includes("conversionLabel: 'Лиды'"), 'HOUSEVIP lead label missing');
ok(html.includes('ux-v2.css?v=20261001-housevip-conclusions1'), 'HOUSEVIP UX stylesheet missing');
ok(html.includes('core.js?v=20261006-housevip-draftguard1'), 'HOUSEVIP lead cache version missing');
ok(html.includes('ux-v2.js?v=20261001-housevip-conclusions1'), 'HOUSEVIP UX controller missing');
['overview','campaigns','funnel','leads','weekly','project'].forEach(view => {
  ok(js.includes(`['${view}'`) || js.includes(`,'${view}'`) || js.includes(`===\'${view}\'`) || js.includes(`===\"${view}\"`), `${view} UX route missing`);
});
ok(js.includes("showProject('leads','meta','ЛИДЫ')"), 'direct Meta leads route missing');
ok(js.includes("byId('uxWeeklyAdd').addEventListener"), 'weekly form bridge missing');
ok(js.includes('summaryObserver.observe(mainCards'), 'live KPI summary observer missing');
ok(css.includes('body.housevip-ux-v2 #mainCards'), 'HOUSEVIP KPI layout missing');
ok(css.includes('.lead-card textarea{background:var(--panel);color:var(--text);border-color:var(--line);color-scheme:dark}'), 'dark lead controls theme missing');
ok(css.includes('.lead-card textarea{background:#fff;color:var(--text);color-scheme:light}'), 'light lead controls theme missing');
ok(css.includes('.lead-card select option{background:#fff;color:var(--text)}'), 'light lead option theme missing');
ok(css.includes('[data-lead-stage="won"]'), 'won funnel stage color missing');
ok(css.includes('[data-lead-stage="lost"]'), 'lost funnel stage color missing');
ok(css.includes('.lead-status-date'), 'status date styling missing');
ok(css.includes('@media(max-width:760px)'), 'HOUSEVIP responsive layout missing');

console.log('HOUSEVIP UX integration guards passed');
