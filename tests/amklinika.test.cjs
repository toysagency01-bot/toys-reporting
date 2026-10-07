const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const ok = (value, message) => { if(!value) throw new Error(message); };

const html = read('amklinika-k8m2','index.html');
const core = read('amklinika-k8m2','core.js');
const ux = read('amklinika-k8m2','ux-v2.js');
const css = read('amklinika-k8m2','ux-v2.css');
const backend = read('..','artifacts','weekly-comments','Code.gs');

ok(html.includes("title: 'AM Klinika'"), 'AM Klinika title missing');
ok(html.includes("locked: true"), 'AM Klinika must use the same client mode as HouseVIP');
ok(html.includes('./core.js?v=20261007-am-leadsave1'), 'AM Klinika must load its HouseVIP-based core copy');
ok(html.includes('./ux-v2.js?v=20261001-am-conclusions1'), 'AM Klinika must load its HouseVIP-based UX copy');
ok(html.includes('./ux-v2.css?v=20261001-am-conclusions1'), 'AM Klinika must load its HouseVIP-based styles');
ok(!html.includes('./amklinika.js'), 'the abandoned custom AM CRM bundle must not load');
ok(!html.includes('./amklinika.css'), 'the abandoned custom AM CRM styles must not load');

ok(html.includes("key: 'google'"), 'AM Klinika must expose a Google project channel');
['План работы (Google)','Еженедельная сводка (Google)','Месячная сводка (Google)','Ключевые слова (Google)','Объявления (Google)'].forEach(tab => {
  ok(html.includes(`tab: '${tab}'`), `AM Klinika Google tab missing: ${tab}`);
});
ok(html.includes("{tab: 'ЛИДЫ', label: 'ЛИДЫ', mode: 'lead-feedback'}"), 'AM Klinika lead route missing');
ok(html.includes("leadApiUrl: 'https://script.google.com/macros/s/"), 'shared lead API missing');

ok(core.includes("if(tabDef.mode === 'lead-feedback') return renderLeadFeedback(tabDef)"), 'HouseVIP lead view was not generalized for AM Klinika');
ok(core.includes("mode:'lead-list',project:WEEKLY_PROJECT_KEY"), 'AM Klinika must load leads from the shared backend');
ok(core.includes("WEEKLY_PROJECT_KEY==='amklinika-k8m2'"), 'AM Klinika must have a direct project-sheet read path');
ok(core.includes("gvizFrom(C.projectSheetId,sheetName"), 'AM Klinika lead reads must use the existing GViz transport');
ok(core.includes("{sheet:'Lead Site',key:'site'"), 'AM Klinika site leads source missing');
ok(core.includes("{sheet:'Lead_meta_cz_mechanic',key:'meta_mechanic_cz'"), 'AM Klinika Meta sources missing');
ok(core.includes("width:16,range:'A:P'"), 'AM Klinika lead IDs must use the stable first 16 Meta columns');
ok(core.includes('function leadVerifyStored(record,deadline)'), 'AM Klinika lead saves must retry storage verification');
ok(core.includes("form.method='post';form.action=WEEKLY_FORM_URL"), 'AM Klinika lead saves must use the authenticated iframe response bridge');
ok(core.includes("event.data.type==='lead-feedback-error'"), 'AM Klinika must surface the real backend save error');
ok(!core.includes("fetch(WEEKLY_FORM_URL,{method:'POST',mode:'no-cors'"), 'AM Klinika must not hide lead-save backend errors behind no-cors');
ok(core.includes('if(C.projectApiKey && !hasConfiguredTabs) discoverChannelTabs(bootReady)'), 'configured AM tabs must not be overwritten by sheet discovery');
ok(core.includes('data-role="status"'), 'lead status dropdown is missing');
ok(core.includes('data-role="comment"'), 'editable lead comment is missing');
ok(core.includes('data-role="status-date"'), 'status change date is missing');
ok(core.includes("'Работа завершена':'won'"), 'AM Klinika status colours are missing');
ok(ux.includes("['leads','Лиды']"), 'top-level Leads navigation is missing');
ok(ux.includes('UX_CHANNELS.map'), 'project channel switcher must follow AM Klinika config');
ok(css.includes('.lead-card'), 'HouseVIP lead card styles are missing');
ok(css.includes(':root[data-theme="light"]'), 'lead controls need a light-theme override');

ok(backend.includes("'amklinika-k8m2': {"), 'shared backend AM Klinika config missing');
['Lead Site','Lead_meta_new','Lead_meta_ru','Lead_meta_ru_mechanic','Lead_meta_cz_mechanic'].forEach(tab => {
  ok(backend.includes(`{sheet:'${tab}'`), `shared backend source missing: ${tab}`);
});
ok(backend.includes('WCS_AMKLINIKA_STATUSES'), 'AM Klinika repair statuses missing');
ok(backend.includes('function wcsListMultiSourceLeads_'), 'shared multi-source parser missing');
ok(backend.includes('function wcsMultiSourceLeadExists_'), 'lead saves must validate source rows');

console.log('AM Klinika HouseVIP-clone integration guards passed');
