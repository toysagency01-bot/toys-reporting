const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const theme = fs.readFileSync(path.join(root, 'core', 'theme.js'), 'utf8');
const sharedCore = fs.readFileSync(path.join(root, 'core', 'core.js'), 'utf8');
const housevipCore = fs.readFileSync(path.join(root, 'housevip-cxp7', 'core.js'), 'utf8');
const instashopCore = fs.readFileSync(path.join(root, 'core', 'instashop.js'), 'utf8');

function ok(value, message) {
  if (!value) throw new Error(message);
}

const indexFiles = [path.join(root, 'index.html')]
  .concat(fs.readdirSync(root, {withFileTypes:true})
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'index.html')))
    .map(entry => path.join(root, entry.name, 'index.html')));

indexFiles.forEach(file => {
  const html = fs.readFileSync(file, 'utf8');
  ok(html.includes('theme.js?v=20260928-theme1'), `theme module missing: ${path.relative(root, file)}`);
});

ok(theme.includes("localStorage.setItem(STORAGE_KEY, theme)"), 'theme choice persistence missing');
ok(theme.includes("root.dataset.theme = storedTheme() || 'dark'"), 'dark default or stored theme restore missing');
ok(theme.includes("id = 'toysThemeToggle'"), 'theme toggle button missing');
ok(theme.includes(':root[data-theme="light"]'), 'light palette missing');
ok(theme.includes("window.dispatchEvent(new CustomEvent('toys-theme-change'"), 'theme redraw event missing');
ok(sharedCore.includes("window.addEventListener('toys-theme-change'"), 'shared dashboard redraw hook missing');
ok(housevipCore.includes("window.addEventListener('toys-theme-change'"), 'HOUSEVIP redraw hook missing');
ok(instashopCore.includes("window.addEventListener('toys-theme-change'"), 'Instashop redraw hook missing');
ok(sharedCore.includes('themeChartConfig(cfg)'), 'shared chart theming missing');
ok(housevipCore.includes('themeChartConfig(cfg)'), 'HOUSEVIP chart theming missing');
ok(instashopCore.includes('themeChartConfig({data:'), 'Instashop chart theming missing');

console.log(`theme integration guards passed for ${indexFiles.length} dashboards`);
