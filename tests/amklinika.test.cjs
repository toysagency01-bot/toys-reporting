const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const ok = (value, message) => { if(!value) throw new Error(message); };

const html = read('amklinika-k8m2','index.html');
const app = read('amklinika-k8m2','amklinika.js');
const core = read('core','core.js');

ok(!html.includes("key: 'google'"), 'AM Klinika must not expose a Google project channel');
ok(!html.includes('План работы (Google)'), 'AM Klinika must not expose Google tabs');
['Lead Site','Lead_meta_new','Lead_meta_ru','Lead_meta_ru_mechanic','Lead_meta_cz_mechanic'].forEach(tab => {
  ok(html.includes(`tab: '${tab}'`), `AM Klinika lead tab missing: ${tab}`);
});
ok(html.includes("key: 'leads'"), 'AM Klinika leads channel missing');
ok(html.includes('./amklinika.js?v=20260930-leads1'), 'AM Klinika lead renderer missing');
ok(html.includes('../core/ux-v2.js?v=20260930-amleads1'), 'AM Klinika nested route fix missing');
ok(core.includes("tabDef.mode === 'am-leads' && typeof window.renderAmLeads === 'function'"), 'AM Klinika lead mode guard missing');
ok(app.includes('window.renderAmLeads = function'), 'AM Klinika lead renderer must register explicitly');
ok(core.includes("activeGenericRequest === tabDef.tab"), 'project tab race guard missing');
ok(app.includes("first === 'id' || first === 'дата'"), 'repeated lead headers must be filtered');
ok(app.includes("raw.filter(row => row.some(value => clean(value)) && !isHeader(row))"), 'lead rows must ignore blanks and embedded headers');
ok(app.includes('В этой вкладке пока нет лидов.'), 'empty lead tabs need a clear non-error state');

console.log('AM Klinika isolated lead import guards passed');
