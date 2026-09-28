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
  ]) {
    assert.ok(names.includes(required), `missing table ${required}`);
  }
  db.close();
});

test('the active registry is seeded as draft projects without exposing live data', () => {
  const db = migratedDatabase();
  const count = db.prepare('SELECT COUNT(*) AS count FROM projects').get().count;
  const active = db.prepare("SELECT COUNT(*) AS count FROM projects WHERE status = 'active'").get().count;
  assert.equal(count, 15);
  assert.equal(active, 0);
  assert.equal(db.prepare("SELECT project_type FROM projects WHERE slug = 'housevip-cxp7'").get().project_type, 'leadgen');
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

