const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const prototypeDir = path.join(root, 'karlovarska-v2-concept');
const html = fs.readFileSync(path.join(prototypeDir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(prototypeDir, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(prototypeDir, 'styles.css'), 'utf8');

function ok(value, message){
  if(!value) throw new Error(message);
}

['overview', 'campaigns', 'funnel', 'weekly'].forEach(view => {
  ok(html.includes(`data-view="${view}"`), `${view} navigation item missing`);
  ok(html.includes(`data-view-panel="${view}"`), `${view} panel missing`);
});

ok(html.includes('UX-ПРОТОТИП'), 'prototype must be visibly labelled');
ok(html.includes('ГЛАВНЫЙ ВЫВОД'), 'executive insight block missing');
ok(html.includes('Требует внимания'), 'attention block missing');
ok(html.includes('Все каналы'), 'global channel filter missing');
ok(js.includes("localStorage.setItem('toys-prototype-theme'"), 'prototype theme persistence missing');
ok(css.includes('@media(max-width:760px)'), 'responsive tablet/mobile layout missing');
ok(css.includes(':root[data-theme="dark"]'), 'dark theme missing');

console.log('UX prototype integration guards passed');
