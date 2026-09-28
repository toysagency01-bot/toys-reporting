const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const theme = fs.readFileSync(path.join(root, 'core', 'theme.js'), 'utf8');
const sharedCore = fs.readFileSync(path.join(root, 'core', 'core.js'), 'utf8');
const housevipCore = fs.readFileSync(path.join(root, 'housevip-cxp7', 'core.js'), 'utf8');
const instashopCore = fs.readFileSync(path.join(root, 'core', 'instashop.js'), 'utf8');
const projectStatus = JSON.parse(fs.readFileSync(path.join(root, 'config', 'project-status.json'), 'utf8'));

function ok(value, message) {
  if (!value) throw new Error(message);
}

const indexFiles = [path.join(root, 'index.html')]
  .concat(projectStatus.active.map(project => path.join(root, project.slug, 'index.html')));

indexFiles.forEach(file => {
  const html = fs.readFileSync(file, 'utf8');
  ok(html.includes('theme.js?v=20260928-ui2'), `theme module missing: ${path.relative(root, file)}`);
});

projectStatus.active.forEach(project => {
  const html = fs.readFileSync(path.join(root, project.slug, 'index.html'), 'utf8');
  const expectedTitle = project.slug === 'toys-agency-ctft'
    ? 'TOYS AGENCY — Дашборд результатов'
    : `TOYS × ${project.name} — Дашборд результатов`;
  ok(html.includes(`<title>${expectedTitle}</title>`), `page title mismatch: ${project.slug}`);
  ok(html.includes('<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">'), `favicon missing: ${project.slug}`);
});

ok(theme.includes("localStorage.setItem(STORAGE_KEY, theme)"), 'theme choice persistence missing');
ok(theme.includes("root.dataset.theme = storedTheme() || 'dark'"), 'dark default or stored theme restore missing');
ok(theme.includes("id = 'toysThemeToggle'"), 'theme toggle button missing');
ok(theme.includes(':root[data-theme="light"]'), 'light palette missing');
ok(theme.includes("window.dispatchEvent(new CustomEvent('toys-theme-change'"), 'theme redraw event missing');
ok(theme.includes('google:`<svg'), 'Google platform icon missing');
ok(theme.includes('meta:`<svg'), 'Meta platform icon missing');
ok(theme.includes('instagram:`<svg'), 'Instagram platform icon missing');
ok(theme.includes("document.querySelectorAll('#viewTabs button,#platformSeg button,#projectSubNav button')"), 'navigation icon decoration missing');
ok(theme.includes('html body .tabs{width:max-content'), 'dashboard pill navigation styling missing');
ok(theme.includes('html body .card{position:relative'), 'dashboard KPI card styling missing');
ok(theme.includes('new MutationObserver(scheduleDecoration)'), 'dynamic UI decoration observer missing');
ok(sharedCore.includes("window.addEventListener('toys-theme-change'"), 'shared dashboard redraw hook missing');
ok(housevipCore.includes("window.addEventListener('toys-theme-change'"), 'HOUSEVIP redraw hook missing');
ok(instashopCore.includes("window.addEventListener('toys-theme-change'"), 'Instashop redraw hook missing');
ok(sharedCore.includes('themeChartConfig(cfg)'), 'shared chart theming missing');
ok(housevipCore.includes('themeChartConfig(cfg)'), 'HOUSEVIP chart theming missing');
ok(instashopCore.includes('themeChartConfig({data:'), 'Instashop chart theming missing');

console.log(`theme integration guards passed for the landing page and ${projectStatus.active.length} active dashboards`);
