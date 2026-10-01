const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const active = JSON.parse(fs.readFileSync(path.join(root, 'config', 'project-status.json'), 'utf8')).active;
const backend = fs.readFileSync(path.resolve(root, '..', 'artifacts', 'weekly-comments', 'Code.gs'), 'utf8');
const mappings = new Map(
  [...backend.matchAll(/'([^']+)':\s*'([^']+)'/g)].map(([, slug, sheetId]) => [slug, sheetId]),
);
const requiredHeaders = ['id','period_start','period_end','summary','wins','issues','changes','next_steps','status'];

async function getText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {...options, redirect: 'follow', signal: controller.signal});
    return {status: response.status, text: await response.text()};
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  const results = [];
  for (const project of active) {
    const sheetId = mappings.get(project.slug);
    if (!sheetId) {
      results.push({slug: project.slug, ok: false, reason: 'missing backend mapping'});
      continue;
    }
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&headers=1&sheet=WeeklyComments&cacheBust=${Date.now()}`;
    try {
      const {status, text} = await getText(url);
      const headersOk = requiredHeaders.every(header => text.includes(`"label":"${header}"`));
      const gvizOk = status === 200 && text.includes('google.visualization.Query.setResponse');
      results.push({
        slug: project.slug,
        ok: gvizOk,
        initialized: headersOk,
        status,
        reason: headersOk ? '' : 'first save will create WeeklyComments',
      });
    } catch (error) {
      results.push({slug: project.slug, ok: false, reason: error.name || error.message});
    }
  }

  const token = `weekly-live-audit-${Date.now()}`;
  const body = new URLSearchParams({
    mode: 'save', project: 'karlovarska-sul-k4rm', replyToken: token,
    accessCode: 'INVALID-AUDIT-CODE', periodStart: '2026-09-24', periodEnd: '2026-09-30',
    summary: 'read-only audit', status: 'published',
  });
  const endpoint = 'https://script.google.com/macros/s/AKfycbyK9gtL224H-MTZZwHdb9cq_2-zQzPs4QyEh_XFxaspR_kYG59iNLTBN29plKUeltfpVQ/exec';
  const backendProbe = await getText(endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'},
    body: body.toString(),
  });
  const backendOk = backendProbe.status === 200 && backendProbe.text.includes('weekly-comment-error') && backendProbe.text.includes(token) && backendProbe.text.includes('Неверный код доступа');

  console.table(results);
  console.log(`Apps Script response probe: ${backendOk ? 'ok' : 'FAILED'}`);
  const failed = results.filter(result => !result.ok);
  const initialized = results.filter(result => result.initialized).length;
  if (failed.length || !backendOk) {
    console.error(`Live audit failed: ${failed.length} project sheet(s), backend=${backendOk}`);
    process.exitCode = 1;
  } else {
    console.log(`Live weekly audit passed for ${results.length} active projects (${initialized} initialized, ${results.length - initialized} ready for first-save initialization).`);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
