const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'core', 'core.js'), 'utf8');
const ux = fs.readFileSync(path.join(root, 'core', 'ux-v2.js'), 'utf8');
const backend = fs.readFileSync(
  path.resolve(root, '..', 'artifacts', 'weekly-comments', 'Code.gs'),
  'utf8',
);
const clients = fs.readFileSync(path.join(root, 'config', 'clients.csv'), 'utf8');
const projectStatus = JSON.parse(fs.readFileSync(path.join(root, 'config', 'project-status.json'), 'utf8'));
const activeProjects = new Set(projectStatus.active.map(project => project.slug));

assert.doesNotMatch(
  core,
  /weeklySubmitFrame'\)\.addEventListener\('load',[^\n]*weeklySaveSucceeded/,
  'iframe load must never be treated as a successful weekly-comment write',
);
assert.match(
  core,
  /event\.data\.replyToken !== weeklySubmitToken/,
  'weekly-comment responses must match the one-time submission token',
);
assert.match(
  core,
  /googleusercontent\\?\.com|googleusercontent/,
  'weekly-comment responses must be restricted to the Apps Script sandbox origin',
);
assert.match(core, /function weeklyVerifyStored\(/, 'weekly writes must be verified against the storage sheet');
assert.match(core, /parseWeeklyComments\(json,true\)/, 'weekly verification must include draft rows');
assert.match(core, /cacheBust=\$\{Date\.now\(\)\}/, 'weekly verification must bypass stale GViz caches');
assert.match(core, /channel:\s*weeklyChannel\(row\[11\]\)/, 'weekly rows must read their traffic channel');
assert.match(core, /function weeklyResolvedChannel\(/, 'legacy weekly rows must resolve to the only configured traffic channel');
assert.match(core, /channels\.size===1\s*\?\s*\[\.\.\.channels\]\[0\]\s*:\s*'all'/, 'legacy channel inference must stay conservative on multi-channel projects');
assert.match(core, /weeklyResolvedChannel\(item\.channel\)===selected/, 'weekly conclusions must follow the selected traffic channel');
assert.match(core, /item\.periodEnd\s*===\s*record\.periodEnd\s*&&\s*weeklyResolvedChannel\(item\.channel\)\s*===\s*record\.channel/, 'weekly verification must match period and resolved channel');
assert.match(ux, /setPeriodControls\(name\)/, 'weekly UX must hide period controls on the conclusions screen');
assert.match(ux, /Выводы и планы/, 'weekly UX must use the universal conclusions label');
assert.match(
  backend,
  /replyToken:replyToken/g,
  'weekly-comment backend must echo the one-time submission token',
);
assert.match(backend, /WCS_LEGACY_HEADERS\.concat\(\['channel'\]\)/, 'backend must migrate the weekly schema non-destructively');
assert.match(backend, /mode === 'weekly-init'/, 'backend must expose an authenticated schema initializer');
assert.match(backend, /existingChannel === channel/, 'backend uniqueness must include the traffic channel');

const coreVersions = new Map();
for (const slug of activeProjects) {
  if (slug === 'amklinika-k8m2') continue; // isolated AM Klinika lead renderer cache-bust
  const indexPath = path.join(root, slug, 'index.html');
  if (!fs.existsSync(indexPath)) continue;
  const html = fs.readFileSync(indexPath, 'utf8');
  const match = html.match(/\.\.\/core\/core\.js\?v=([^"']+)/);
  if (match) coreVersions.set(slug, match[1]);
}
assert.equal(
  new Set(coreVersions.values()).size,
  1,
  `all dashboards must use the same core cache version: ${JSON.stringify([...coreVersions])}`,
);
assert.match(
  fs.readFileSync(path.join(root, 'amklinika-k8m2', 'index.html'), 'utf8'),
  /\.\/core\.js\?v=20261006-am-weeklylegacy1/,
  'AM Klinika must load its HouseVIP-based client core',
);
const instashop = fs.readFileSync(path.join(root, 'core', 'instashop.js'), 'utf8');
assert.doesNotMatch(instashop, /weeklySubmitFrame'\)\.addEventListener\('load'/, 'Instashop must not trust iframe load as save success');
assert.match(instashop, /event\.data\.replyToken !== weeklySubmitToken/, 'Instashop responses must match the one-time token');
assert.match(instashop, /function weeklyVerifyStored\(/, 'Instashop writes must be verified against the storage sheet');
assert.match(instashop, /function weeklyResolvedChannel\(/, 'Instashop must accept legacy rows without a channel column');
assert.match(instashop, /weeklyResolvedChannel\(item\.channel\) === record\.channel/, 'Instashop verification must resolve the legacy channel');
assert.match(instashop, /name="channel" value="meta"/, 'Instashop conclusions must be stored as Meta');
assert.match(instashop, /id="dateRange"/, 'Instashop date controls must be addressable by the conclusions route');

const protectedWeeklyEngines = [
  ['shared core', core],
  ['Instashop', instashop],
  ['HouseVIP', fs.readFileSync(path.join(root, 'housevip-cxp7', 'core.js'), 'utf8')],
  ['AM Klinika', fs.readFileSync(path.join(root, 'amklinika-k8m2', 'core.js'), 'utf8')],
  ['Cloudflare HouseVIP/AM Klinika', fs.readFileSync(path.join(root, 'platform', 'dist', 'housevip-cxp7', 'core.js'), 'utf8')],
];
for (const [name, source] of protectedWeeklyEngines) {
  assert.match(source, /WEEKLY_DRAFT_KEY/, `${name} must keep a project-scoped local draft`);
  assert.match(source, /localStorage\.setItem\(WEEKLY_DRAFT_KEY/, `${name} must autosave the conclusions form`);
  assert.match(source, /function weeklyRestoreDraft\(/, `${name} must restore an interrupted draft`);
  assert.match(source, /window\.confirm\('Есть несохранённые изменения/, `${name} must confirm an intentional close`);
  assert.doesNotMatch(source, /addEventListener\('click',\s*closeWeeklyForm\)/, `${name} must not pass a click event as the force-close flag`);
  assert.match(source, /beforeunload/, `${name} must protect unsaved text during navigation`);
  assert.match(source, /weeklyClearDraft\(\);[\s\S]{0,80}(?:renderWeekly|renderWeeklyComments)/, `${name} must clear a draft only after confirmed save success`);
  assert.doesNotMatch(
    source,
    /event\.target\s*===\s*el\('weeklyModal'\)\)\s*closeWeeklyForm/,
    `${name} must not close the form when the backdrop is clicked`,
  );
}
assert.match(backend, /'amklinika-k8m2': \{/, 'shared backend must configure AM Klinika');
assert.match(backend, /function wcsMultiSourceLeadExists_/, 'lead saves must validate AM Klinika source rows');

const backendMappings = new Map(
  [...backend.matchAll(/'([^']+)':\s*'([^']+)'/g)].map(([, slug, sheetId]) => [slug, sheetId]),
);
const configuredClients = clients
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map(line => line.split(','))
  .map(columns => ({
    slug: columns[2],
    reportSheetId: columns[3] || columns[7],
  }))
  .filter(client => client.slug && client.reportSheetId && activeProjects.has(client.slug));

for (const { slug, reportSheetId } of configuredClients) {
  assert.equal(
    backendMappings.get(slug),
    reportSheetId,
    `weekly-comment backend sheet ID must match clients.csv for ${slug}`,
  );
}

assert.ok(
  configuredClients.some(client => client.slug === 'monorey-acdk'),
  'Monorey must be covered by the integration guard',
);

console.log('weekly-comments integration guards: ok');
