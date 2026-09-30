import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'migrations');

function migratedDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }
  return db;
}

test('all migrations execute and create the required platform tables', () => {
  const db = migratedDatabase();
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name);
  for (const required of [
    'organizations', 'projects', 'users', 'project_memberships', 'integrations',
    'campaigns', 'ad_metrics_daily', 'leads', 'lead_status_events', 'lead_comments',
    'sales', 'weekly_reports', 'exchange_rates', 'sync_runs', 'audit_log',
    'project_tabs',
  ]) {
    assert.ok(names.includes(required), `missing table ${required}`);
  }
  db.close();
});

test('the registry activates only the migrated D1 projects', () => {
  const db = migratedDatabase();
  const count = db.prepare('SELECT COUNT(*) AS count FROM projects').get().count;
  const active = db.prepare("SELECT COUNT(*) AS count FROM projects WHERE status = 'active'").get().count;
  assert.equal(count, 15);
  assert.equal(active, 2);
  assert.equal(db.prepare("SELECT project_type FROM projects WHERE slug = 'housevip-cxp7'").get().project_type, 'leadgen');
  assert.equal(db.prepare("SELECT status FROM projects WHERE slug = 'housevip-cxp7'").get().status, 'active');
  assert.equal(db.prepare("SELECT project_type FROM projects WHERE slug = 'amklinika-k8m2'").get().project_type, 'leadgen');
  assert.equal(db.prepare("SELECT status FROM projects WHERE slug = 'amklinika-k8m2'").get().status, 'active');
  assert.equal(db.prepare("SELECT currency FROM projects WHERE slug = 'amklinika-k8m2'").get().currency, 'CZK');
  assert.equal(db.prepare("SELECT external_account_id FROM integrations WHERE id = 'int_amklinika_meta'").get().external_account_id, '1830858661278666');
  assert.equal(db.prepare("SELECT external_account_id FROM integrations WHERE id = 'int_amklinika_google'").get().external_account_id, '9632942627');
  db.close();
});

test('HOUSEVIP pilot migration matches the verified source totals and contains no lead PII', () => {
  const db = migratedDatabase();
  const totals = db.prepare(`
    SELECT SUM(impressions) AS impressions, SUM(clicks) AS clicks,
           SUM(spend) AS spend, SUM(leads) AS leads
      FROM ad_metrics_daily
     WHERE project_id = 'prj_housevip_cxp7'
  `).get();
  assert.deepEqual({ ...totals }, { impressions: 6180, clicks: 292, spend: 1875890, leads: 16 });
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM leads WHERE project_id = 'prj_housevip_cxp7'").get().count, 0);
  const migration = readFileSync(join(migrationsDir, '0003_housevip_pilot.sql'), 'utf8');
  assert.doesNotMatch(migration, /[\w.+-]+@[\w.-]+|\b420\d{9}\b/);
  const fullMigration = readFileSync(join(migrationsDir, '0004_housevip_full.sql'), 'utf8');
  assert.doesNotMatch(fullMigration, /[\w.+-]+@[\w.-]+|\b420\d{9}\b/);
  assert.equal(db.prepare("SELECT json_extract(settings_json, '$.dataBackend') AS backend FROM projects WHERE id='prj_housevip_cxp7'").get().backend, 'd1');
  assert.equal(db.prepare("SELECT rate FROM exchange_rates WHERE base_currency='IDR' AND quote_currency='EUR'").get().rate, 0.000048911144);
  db.close();
});

test('daily metrics are idempotent per project, provider, campaign and date', () => {
  const db = migratedDatabase();
  const insert = db.prepare(`
    INSERT INTO ad_metrics_daily
      (project_id, provider, external_campaign_id, metric_date, currency, impressions)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const args = ['prj_housevip_cxp7', 'meta_ads', 'cmp_1', '2026-09-28', 'EUR', 100];
  insert.run(...args);
  assert.throws(() => insert.run(...args), /UNIQUE constraint failed/);
  db.close();
});

test('lead identifiers are unique inside a project and source', () => {
  const db = migratedDatabase();
  const insert = db.prepare(`
    INSERT INTO leads (id, project_id, source_provider, external_lead_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  insert.run('lead_1', 'prj_housevip_cxp7', 'meta_ads', 'external_1', '2026-09-28T10:00:00Z');
  assert.throws(
    () => insert.run('lead_2', 'prj_housevip_cxp7', 'meta_ads', 'external_1', '2026-09-28T10:00:00Z'),
    /UNIQUE constraint failed/,
  );
  db.close();
});

