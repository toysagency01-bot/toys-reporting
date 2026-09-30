import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { projectLeadStatuses, sameOriginWrite, validDate } from '../src/index.js';

function database(projects = []) {
  return {
    prepare(sql) {
      return {
        async first() {
          if (sql.includes('SELECT 1 AS ok')) return { ok: 1 };
          return null;
        },
        async all() {
          return { results: projects };
        },
        async run() {
          return { success: true };
        },
      };
    },
  };
}

function env(overrides = {}) {
  return {
    APP_NAME: 'TOYS Agency Platform',
    ENVIRONMENT: 'test',
    TOYS_INTERNAL_TOKEN: 'test-token-that-is-at-least-32-characters-long',
    TOYS_DB: database(),
    ...overrides,
  };
}

function pilotDatabase() {
  const project = {
    id: 'prj_housevip_cxp7', slug: 'housevip-cxp7', name: 'HOUSEVIP',
    projectType: 'leadgen', currency: 'IDR',
    settingsJson: '{"primaryDisplayCurrency":"EUR","sourceCurrency":"IDR"}',
  };
  const daily = [
    { date: '2026-09-25', currency: 'IDR', impressions: 1248, clicks: 56, spend: 345154, leads: 3 },
    { date: '2026-09-26', currency: 'IDR', impressions: 2575, clicks: 119, spend: 771770, leads: 5 },
    { date: '2026-09-27', currency: 'IDR', impressions: 2357, clicks: 117, spend: 758966, leads: 8 },
  ];
  return {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() {
          if (sql.includes('SELECT 1 AS ok')) return { ok: 1 };
          if (sql.includes('FROM projects') && sql.includes("status = 'active'")) return args[0] === project.slug ? { ...project } : null;
          if (sql.includes('MIN(metric_date)')) return { minDate: '2026-09-25', maxDate: '2026-09-27' };
          if (sql.includes('COALESCE(SUM(impressions)')) return { impressions: 6180, clicks: 292, spend: 1875890, leads: 16 };
          return null;
        },
        async all() {
          if (sql.includes('GROUP BY metric_date')) return { results: daily };
          if (sql.includes('LEFT JOIN campaigns')) return { results: [{ provider: 'meta_ads', externalCampaignId: 'legacy:campaign', name: 'Campaign', currency: 'IDR', impressions: 6180, clicks: 292, spend: 1875890, leads: 16 }] };
          return { results: [] };
        },
        async run() { return { success: true }; },
      };
    },
  };
}

test('health endpoint checks the database and returns security headers', async () => {
  const response = await worker.fetch(new Request('https://app.test/api/health'), env());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.database.ok, true);
  assert.equal(body.environment, 'test');
});

test('health endpoint reports a missing database as unavailable', async () => {
  const response = await worker.fetch(new Request('https://app.test/api/health'), env({ TOYS_DB: null }));
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.ok, false);
});

test('internal endpoints reject requests without a server token', async () => {
  const response = await worker.fetch(new Request('https://app.test/api/internal/projects'), env());
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'unauthorized');
});

test('internal projects endpoint returns rows only with a valid token', async () => {
  const projects = [{ id: 'prj_1', slug: 'housevip-cxp7', name: 'HOUSEVIP', projectType: 'leadgen', status: 'draft' }];
  const request = new Request('https://app.test/api/internal/projects', {
    headers: { 'x-toys-internal-token': 'test-token-that-is-at-least-32-characters-long' },
  });
  const response = await worker.fetch(request, env({ TOYS_DB: database(projects) }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).projects, projects);
});

test('unknown API routes return JSON 404', async () => {
  const response = await worker.fetch(new Request('https://app.test/api/nope'), env());
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'not_found');
});

test('public HOUSEVIP dashboard returns verified aggregates without lead PII', async () => {
  const response = await worker.fetch(
    new Request('https://app.test/api/public/projects/housevip-cxp7/dashboard'),
    env({ TOYS_DB: pilotDatabase() }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
  const body = await response.json();
  assert.equal(body.dashboard.totals.impressions, 6180);
  assert.equal(body.dashboard.totals.clicks, 292);
  assert.equal(body.dashboard.totals.spend, 1875890);
  assert.equal(body.dashboard.totals.leads, 16);
  assert.equal(body.dashboard.totals.ctr.toFixed(2), '4.72');
  assert.equal(body.dashboard.totals.cpl.toFixed(2), '117243.13');
  assert.equal(JSON.stringify(body).includes('phone'), false);
  assert.equal(JSON.stringify(body).includes('email'), false);
});

test('public dashboards hide inactive or unknown projects', async () => {
  const response = await worker.fetch(
    new Request('https://app.test/api/public/projects/not-a-project/dashboard'),
    env({ TOYS_DB: pilotDatabase() }),
  );
  assert.equal(response.status, 404);
});

test('date validation rejects impossible calendar dates', () => {
  assert.equal(validDate('2026-09-28'), true);
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('28.09.2026'), false);
});

test('public write endpoints accept same-origin requests and reject cross-origin requests', () => {
  assert.equal(sameOriginWrite(new Request('https://app.test/api', { headers: { origin: 'https://app.test' } })), true);
  assert.equal(sameOriginWrite(new Request('https://app.test/api', { headers: { origin: 'https://evil.test' } })), false);
});

test('lead statuses are project-specific and fall back to the HOUSEVIP funnel', () => {
  const am = projectLeadStatuses({ settingsJson: '{"leadStatuses":["Новый","Диагностика назначена","Завершён"]}' });
  assert.deepEqual(am, ['Новый', 'Диагностика назначена', 'Завершён']);
  assert.ok(projectLeadStatuses({ settingsJson: '{}' }).includes('Просмотр назначен'));
});

