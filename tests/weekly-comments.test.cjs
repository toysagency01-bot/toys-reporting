const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'core', 'core.js'), 'utf8');
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
assert.match(
  backend,
  /replyToken:replyToken/g,
  'weekly-comment backend must echo the one-time submission token',
);

const coreVersions = new Map();
for (const slug of activeProjects) {
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
