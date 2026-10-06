const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const projectStatus = JSON.parse(fs.readFileSync(path.join(root, 'config', 'project-status.json'), 'utf8'));
const activeProjects = projectStatus.active.map(project => project.slug);
const inactiveProjects = new Set(projectStatus.inactive.map(project => project.slug));
const individualProjects = new Set(['housevip-cxp7', 'profkit-instashop-r4vk', 'amklinika-k8m2']);
const sharedProjects = activeProjects.filter(project => !individualProjects.has(project));
const ok = (value, message) => { if(!value) throw new Error(message); };
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

ok(activeProjects.length === 15, `expected 15 active dashboards, got ${activeProjects.length}`);
activeProjects.forEach(project => ok(!inactiveProjects.has(project), `${project}: cannot be active and inactive`));

sharedProjects.forEach(project => {
  const html = read(project, 'index.html');
  ok(html.includes('../core/ux-v2.css?v=20261001-conclusions1'), `${project}: global UX CSS missing`);
  ok(html.includes('../core/ux-v2.js?v=20261001-conclusions1'), `${project}: global UX controller missing`);
  ok(html.indexOf('../core/core.js?v=20261006-draftguard1') < html.indexOf('../core/ux-v2.js?v=20261001-conclusions1'), `${project}: UX must run after the data engine`);
});

const sharedUx = read('core', 'ux-v2.js');
['overview','campaigns','funnel','weekly','project'].forEach(route => ok(sharedUx.includes(`'${route}'`), `global route ${route} missing`));
ok(sharedUx.includes("legacyTabs?.querySelector('[data-view=\"metrics\"]')?.click()"), 'legacy metrics bridge missing');
ok(sharedUx.includes("byId('uxWeeklyAdd')?.addEventListener"), 'weekly form bridge missing');
ok(sharedUx.includes('MutationObserver(schedule)'), 'live data observer missing');
ok(sharedUx.includes("routeView=route.split('/')[0]"), 'nested project route guard missing');
ok(sharedUx.includes("current.startsWith(`${target}/`)"), 'nested project route preservation missing');
const instashop = read('profkit-instashop-r4vk','index.html');
ok(instashop.includes('../core/ux-v2-instashop.js?v=20261001-instashop-conclusions1'), 'Instashop UX controller missing');
ok(instashop.includes('../core/instashop.js?v=20261006-instashop-draftguard1'), 'Instashop data engine missing');

const housevip = read('housevip-cxp7','index.html');
ok(housevip.includes('./ux-v2.js?v=20261001-housevip-conclusions1'), 'HOUSEVIP individual UX must remain enabled');
ok(!housevip.includes('../core/ux-v2.js'), 'HOUSEVIP must not load the shared UX on top of its individual UX');

['master','zzz-test-onboarding-dayy','karlovarska-v2-concept'].forEach(project => {
  const html = read(project,'index.html');
  ok(!html.includes('global-ux1'), `${project}: non-production page must not receive rollout`);
});

console.log(`global UX guards passed for ${activeProjects.length} active production dashboards`);
