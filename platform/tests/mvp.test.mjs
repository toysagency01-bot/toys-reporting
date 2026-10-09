import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { buildImportSql } from '../scripts/build-housevip-mvp-import.mjs';
import { buildDemoCommerceSql } from '../scripts/build-demo-commerce-mvp-import.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function sqlite() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(join(root, 'migrations')).filter(name => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(root, 'migrations', file), 'utf8'));
  }
  return db;
}

function d1(db) {
  class Statement {
    constructor(sql) { this.statement = db.prepare(sql); this.args = []; }
    bind(...args) { this.args = args; return this; }
    async first() { return this.statement.get(...this.args) || null; }
    async all() { return { results: this.statement.all(...this.args) }; }
    async run() {
      const result = this.statement.run(...this.args);
      return { success: true, meta: { changes: Number(result.changes) } };
    }
  }
  return {
    prepare(sql) { return new Statement(sql); },
    async batch(statements) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function snapshot() {
  return {
    schema_version: 'housevip-pilot-snapshot/1.0',
    generated_at: '2026-10-09T09:16:57.902Z',
    project: 'HOUSEVIP',
    requested_window: { start: '2026-09-10', end: '2026-10-09', timezone: 'Asia/Tbilisi' },
    privacy: { includes_personal_lead_or_contact_rows: false, includes_secrets: false },
    ad_rows: [
      { date: '2026-10-07', platform: 'Meta Ads', currency: 'IDR', campaign: 'Legacy A', impressions: 0, clicks: 0, cost: 100, conversions: 0, conv_value: 0, source_tab: 'MetaAds', source_row: 2 },
      { date: '2026-10-08', platform: 'Meta Ads', currency: 'IDR', campaign: 'Legacy B', impressions: 100, clicks: 10, cost: 300, conversions: 2.27, conv_value: 0, source_tab: 'MetaAds', source_row: 3 },
    ],
    aggregates: { control_totals_by_currency: [{ currency: 'IDR', impressions: 100, clicks: 10, cost: 400, conversions: 2.27, conv_value: 0 }] },
    coverage: { observed_min: '2026-10-07', observed_max: '2026-10-08', available_rows: 2, missing_days_are_not_zero: true },
  };
}

function env(db, overrides = {}) {
  return {
    ENVIRONMENT: 'test',
    APP_NAME: 'MVP test',
    MVP_VIEW_TOKEN: 'housevip-test-view-token-0001',
    MVP_EDITOR_TOKEN: 'housevip-test-editor-token-0001',
    MVP_VIEW_PROJECTS: 'housevip-cxp7',
    MVP_EDITOR_PROJECTS: 'housevip-cxp7',
    TOYS_DB: d1(db),
    ...overrides,
  };
}

function request(path, token, init = {}) {
  const headers = new Headers(init.headers || {});
  if (token) headers.set('authorization', `Bearer ${token}`);
  return new Request(`https://mvp.test${path}`, { ...init, headers });
}

test('safe snapshot import is idempotent and preserves observed zero, fractional values and legacy identity', () => {
  const db = sqlite();
  const built = buildImportSql(snapshot());
  db.exec(built.sql);
  db.exec(built.sql);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM data_generations WHERE project_id='prj_housevip_cxp7'").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM project_data_releases WHERE project_id='prj_housevip_cxp7'").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM fact_observations WHERE project_id='prj_housevip_cxp7'").get().n, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM fact_values WHERE project_id='prj_housevip_cxp7'").get().n, 10);
  assert.equal(db.prepare("SELECT value_text FROM fact_values WHERE metric_code='ads.reported_conversions' ORDER BY CAST(value_text AS REAL) DESC LIMIT 1").get().value_text, '2.27');
  assert.equal(db.prepare("SELECT value_state FROM fact_values WHERE metric_code='ads.impressions' AND value_text='0'").get().value_state, 'observed');
  const identity = db.prepare('SELECT provider_campaign_id, legacy_group_ref FROM fact_observations LIMIT 1').get();
  assert.equal(identity.provider_campaign_id, null);
  assert.match(identity.legacy_group_ref, /^legacy_group_/);
  const pointer = db.prepare("SELECT release_id, pointer_revision AS pointerRevision FROM project_data_release_pointers WHERE project_id='prj_housevip_cxp7'").get();
  const empty = snapshot(); empty.ad_rows = []; empty.coverage.available_rows = 0;
  assert.throws(() => buildImportSql(empty), /no advertising rows/);
  assert.deepEqual(db.prepare("SELECT release_id, pointer_revision AS pointerRevision FROM project_data_release_pointers WHERE project_id='prj_housevip_cxp7'").get(), pointer);
  const next = snapshot();
  next.generated_at = '2026-10-09T10:16:57.902Z';
  next.ad_rows[1].clicks = 11;
  next.aggregates.control_totals_by_currency[0].clicks = 11;
  db.exec(buildImportSql(next, { expectedPointerRevision: 1 }).sql);
  const nextPointer = db.prepare("SELECT release_id, pointer_revision AS pointerRevision FROM project_data_release_pointers WHERE project_id='prj_housevip_cxp7'").get();
  assert.notEqual(nextPointer.release_id, pointer.release_id);
  assert.equal(nextPointer.pointerRevision, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM project_data_releases WHERE project_id='prj_housevip_cxp7'").get().n, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM fact_observations WHERE project_id='prj_housevip_cxp7'").get().n, 4);
  db.exec(built.sql);
  assert.deepEqual(
    db.prepare("SELECT release_id, pointer_revision AS pointerRevision FROM project_data_release_pointers WHERE project_id='prj_housevip_cxp7'").get(),
    nextPointer,
  );
  const competing = snapshot();
  competing.generated_at = '2026-10-09T11:16:57.902Z';
  competing.ad_rows[1].clicks = 12;
  competing.aggregates.control_totals_by_currency[0].clicks = 12;
  db.exec(buildImportSql(competing, { expectedPointerRevision: 1 }).sql);
  assert.deepEqual(
    db.prepare("SELECT release_id, pointer_revision AS pointerRevision FROM project_data_release_pointers WHERE project_id='prj_housevip_cxp7'").get(),
    nextPointer,
  );
  db.close();
});

test('verified HOUSEVIP runner refuses to report a non-current imported release as success', () => {
  const runner = readFileSync(new URL('../scripts/run-housevip-mvp-import.mjs', import.meta.url), 'utf8');
  assert.match(runner, /release already imported but is not current/);
  assert.doesNotMatch(runner, /ok:\s*true,\s*status:\s*before\.releaseId/);
});

test('v2 dashboard is deny-by-default, project scoped and exposes partial coverage without PII', async () => {
  const db = sqlite();
  db.exec(buildImportSql(snapshot()).sql);
  const runtime = env(db);
  const missing = await worker.fetch(request('/api/v2/projects/housevip-cxp7/dashboard'), runtime);
  assert.equal(missing.status, 401);
  const cross = await worker.fetch(request('/api/v2/projects/amklinika-k8m2/dashboard', runtime.MVP_VIEW_TOKEN), runtime);
  assert.equal(cross.status, 403);
  assert.equal((await cross.json()).error, 'project_scope_forbidden');
  const result = await worker.fetch(request('/api/v2/projects/housevip-cxp7/dashboard', runtime.MVP_VIEW_TOKEN), runtime);
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.dashboard.schemaVersion, 'toys-dashboard/2.0');
  assert.equal(body.dashboard.coverage.status, 'partial');
  assert.equal(body.dashboard.facts.rows.length, 2);
  assert.equal(body.dashboard.panels.find(item => item.code === 'ads.reported_conversions').value, '2.27');
  assert.equal(body.dashboard.panels.find(item => item.code === 'ads.impressions').value, '100');
  assert.equal(JSON.stringify(body).includes('phone'), false);
  assert.equal(JSON.stringify(body).includes('email'), false);

  const staleRuntime = env(db, { MVP_AS_OF_DATE: '2026-10-12' });
  const staleResult = await worker.fetch(request('/api/v2/projects/housevip-cxp7/dashboard', staleRuntime.MVP_VIEW_TOKEN), staleRuntime);
  const staleBody = await staleResult.json();
  assert.equal(staleBody.dashboard.coverage.freshness, 'stale');
  assert.equal(staleBody.dashboard.panels.every(item => item.freshness === 'stale'), true);

  db.prepare("DELETE FROM fact_values WHERE observation_id=(SELECT id FROM fact_observations ORDER BY local_date LIMIT 1) AND metric_code='ads.clicks'").run();
  const missingResult = await worker.fetch(request('/api/v2/projects/housevip-cxp7/dashboard', runtime.MVP_VIEW_TOKEN), runtime);
  const missingBody = await missingResult.json();
  const missingClicks = missingBody.dashboard.panels.find(item => item.code === 'ads.clicks');
  assert.deepEqual({ state: missingClicks.state, value: missingClicks.value, reason: missingClicks.reason }, { state: 'missing', value: null, reason: 'missing_component' });
  db.close();
});

test('synthetic commerce project exposes alternative ecom grains and project-only Instashop sales', async () => {
  const db = sqlite();
  const built = buildDemoCommerceSql();
  db.exec(built.sql);
  db.exec(built.sql);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM data_generations WHERE project_id='prj_demo_commerce_mvp'").get().n, 4);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM fact_observations WHERE project_id='prj_demo_commerce_mvp'").get().n, 42);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM project_data_releases WHERE project_id='prj_demo_commerce_mvp'").get().n, 1);
  const runtime = env(db, { MVP_VIEW_PROJECTS: 'housevip-cxp7,demo-commerce-mvp' });
  const result = await worker.fetch(request('/api/v2/projects/demo-commerce-mvp/dashboard', runtime.MVP_VIEW_TOKEN), runtime);
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.dashboard.schemaVersion, 'toys-commerce-dashboard/1.0');
  assert.equal(body.dashboard.demo.synthetic, true);
  assert.equal(body.dashboard.demo.containsRealClientData, false);
  assert.equal(body.dashboard.ecommerce.viewsAreAlternative, true);
  const metricTotal = (rows, code) => rows.reduce((sum, row) => {
    const value = row.metrics.find(item => item.metricCode === code);
    return sum + Number(value?.value || 0);
  }, 0);
  const accountSpend = metricTotal(body.dashboard.ecommerce.account.rows, 'ads.spend');
  const campaignSpend = metricTotal(body.dashboard.ecommerce.campaigns.rows, 'ads.spend');
  assert.equal(accountSpend, campaignSpend);
  assert.equal(accountSpend, 990);
  assert.notEqual(accountSpend, accountSpend + campaignSpend);
  assert.equal(body.dashboard.ecommerce.account.grain, 'account_daily');
  assert.equal(body.dashboard.ecommerce.campaigns.grain, 'campaign_daily');
  assert.equal(body.dashboard.instashop.sales.grain, 'project_daily');
  assert.equal(body.dashboard.instashop.campaignSales.state, 'unsupported');
  assert.equal(body.dashboard.instashop.currencyPolicy.additive, false);
  assert.equal(JSON.stringify(body).includes('HOUSEVIP'), false);
  db.close();
});

test('content edit creates immutable revision, publishes with CAS, reads back and rejects stale revision', async () => {
  const db = sqlite();
  db.exec(buildImportSql(snapshot()).sql);
  const runtime = env(db);
  const token = runtime.MVP_EDITOR_TOKEN;
  const beforeResponse = await worker.fetch(request('/api/v2/projects/housevip-cxp7/content?logicalKey=weekly-main', token), runtime);
  const before = await beforeResponse.json();
  const revisionKey = crypto.randomUUID();
  const createRequest = () => request('/api/v2/projects/housevip-cxp7/content/weekly-main/revisions', token, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-idempotency-key': revisionKey },
    body: JSON.stringify({ expectedRevision: 1, reason: 'test', blocks: [{ type: 'period_summary', blockKey: 'summary', payload: { summary: 'Readback value' } }] }),
  });
  const createdResponse = await worker.fetch(createRequest(), runtime);
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  const retry = await (await worker.fetch(createRequest(), runtime)).json();
  assert.equal(retry.revision.id, created.revision.id);
  const createKeyReuse = await worker.fetch(request('/api/v2/projects/housevip-cxp7/content/weekly-main/revisions', token, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-idempotency-key': revisionKey },
    body: JSON.stringify({ expectedRevision: 1, reason: 'different', blocks: [{ type: 'period_summary', blockKey: 'summary', payload: { summary: 'Different payload' } }] }),
  }), runtime);
  assert.equal(createKeyReuse.status, 409);
  assert.equal((await createKeyReuse.json()).error, 'idempotency_key_reuse');
  const publishKey = crypto.randomUUID();
  const publishRequest = expectedPublishedRevisionId => request(`/api/v2/projects/housevip-cxp7/content/weekly-main/revisions/${created.revision.id}/publish`, token, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-idempotency-key': publishKey },
    body: JSON.stringify({ expectedPublishedRevisionId }),
  });
  const publishResponse = await worker.fetch(publishRequest(before.item.publishedRevisionId), runtime);
  assert.equal(publishResponse.status, 200);
  const published = await publishResponse.json();
  assert.equal(published.readback.blocks[0].payload.summary, 'Readback value');
  const publishRetry = await (await worker.fetch(publishRequest(before.item.publishedRevisionId), runtime)).json();
  assert.equal(publishRetry.publishedRevisionId, created.revision.id);
  const publishKeyReuse = await worker.fetch(publishRequest(created.revision.id), runtime);
  assert.equal(publishKeyReuse.status, 409);
  assert.equal((await publishKeyReuse.json()).error, 'idempotency_key_reuse');
  const stale = await worker.fetch(request('/api/v2/projects/housevip-cxp7/content/weekly-main/revisions', token, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({ expectedRevision: 1, blocks: [{ type: 'period_summary', blockKey: 'summary', payload: { summary: 'stale' } }] }),
  }), runtime);
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error, 'revision_conflict');
  const atomicKey = crypto.randomUUID();
  const atomicRequest = summary => request('/api/v2/projects/housevip-cxp7/content/weekly-main/save-and-publish', token, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-idempotency-key': atomicKey },
    body: JSON.stringify({ expectedRevision: 2, expectedPublishedRevisionId: created.revision.id, reason: 'atomic test', blocks: [{ type: 'period_summary', blockKey: 'summary', payload: { summary } }] }),
  });
  const atomicResponse = await worker.fetch(atomicRequest('Atomic readback'), runtime);
  assert.equal(atomicResponse.status, 201);
  const atomic = await atomicResponse.json();
  assert.equal(atomic.readback.blocks[0].payload.summary, 'Atomic readback');
  assert.equal(atomic.revision.parentRevisionId, created.revision.id);
  const atomicRetry = await (await worker.fetch(atomicRequest('Atomic readback'), runtime)).json();
  assert.equal(atomicRetry.revision.id, atomic.revision.id);
  const atomicKeyReuse = await worker.fetch(atomicRequest('Different atomic payload'), runtime);
  assert.equal(atomicKeyReuse.status, 409);
  assert.equal((await atomicKeyReuse.json()).error, 'idempotency_key_reuse');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM content_revisions WHERE content_item_id='content_housevip_weekly_main'").get().n, 3);
  db.close();
});
