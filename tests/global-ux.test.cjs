const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sharedProjects = [
  'akademiya-era-3pbm','amklinika-k8m2','bs-clinic-a5b4','colizeum-madrid-ytnc',
  'drc-gzsn','europisol-tckt','gbt-clinic-ydwc','karlovarska-sul-k4rm',
  'kl-advisory-cz-qevz','kovru-ywms','lor-xh83','mimaussy-7tuj','monorey-acdk',
  'murmur-up8m','mypulse-mutk','nexa-max-rne3','profkit-yg2a','seven-sky-5cr7',
  'taycher-5pxk','toys-agency-ctft','tribute-eany','tribute-us-m2nf',
  'visa-agency-qa3b','wedoprofi-p8x4','ytn7-wqsf'
];
const ok = (value, message) => { if(!value) throw new Error(message); };
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

sharedProjects.forEach(project => {
  const html = read(project, 'index.html');
  ok(html.includes('../core/ux-v2.css?v=20260928-global-ux1'), `${project}: global UX CSS missing`);
  ok(html.includes('../core/ux-v2.js?v=20260928-global-ux1'), `${project}: global UX controller missing`);
  ok(html.indexOf('../core/core.js?v=20260928-theme1') < html.indexOf('../core/ux-v2.js?v=20260928-global-ux1'), `${project}: UX must run after the data engine`);
});

const sharedUx = read('core', 'ux-v2.js');
['overview','campaigns','funnel','weekly','project'].forEach(route => ok(sharedUx.includes(`'${route}'`), `global route ${route} missing`));
ok(sharedUx.includes("legacyTabs?.querySelector('[data-view=\"metrics\"]')?.click()"), 'legacy metrics bridge missing');
ok(sharedUx.includes("byId('uxWeeklyAdd')?.addEventListener"), 'weekly form bridge missing');
ok(sharedUx.includes('MutationObserver(schedule)'), 'live data observer missing');
ok(read('mypulse-mutk','index.html').includes('mypulse-funnel.js'), 'MyPulse custom funnel must remain enabled');

const instashop = read('profkit-instashop-r4vk','index.html');
ok(instashop.includes('../core/ux-v2-instashop.js?v=20260928-global-ux1'), 'Instashop UX controller missing');
ok(instashop.includes('../core/instashop.js?v=20260928-theme1'), 'Instashop data engine missing');

const housevip = read('housevip-cxp7','index.html');
ok(housevip.includes('./ux-v2.js?v=20260928-housevip-ux3'), 'HOUSEVIP individual UX must remain enabled');
ok(!housevip.includes('../core/ux-v2.js'), 'HOUSEVIP must not load the shared UX on top of its individual UX');

['master','zzz-test-onboarding-dayy','karlovarska-v2-concept'].forEach(project => {
  const html = read(project,'index.html');
  ok(!html.includes('global-ux1'), `${project}: non-production page must not receive rollout`);
});

console.log(`global UX guards passed for ${sharedProjects.length + 2} production dashboards`);
