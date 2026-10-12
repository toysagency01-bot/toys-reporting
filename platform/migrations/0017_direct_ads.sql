-- Canonical provider-native daily snapshots. No credentials or CRM contacts.
CREATE TABLE IF NOT EXISTS ads_daily_snapshots (
 scope_key TEXT NOT NULL, local_date TEXT NOT NULL,
 organization_id TEXT NOT NULL, project_id TEXT NOT NULL, integration_id TEXT NOT NULL,
 provider TEXT NOT NULL, payload_json TEXT NOT NULL, content_hash TEXT NOT NULL,
 checked_at TEXT NOT NULL, PRIMARY KEY(scope_key,local_date)
);
CREATE INDEX IF NOT EXISTS idx_ads_daily_project ON ads_daily_snapshots(project_id,integration_id,local_date);
CREATE TABLE IF NOT EXISTS ads_import_status (
 integration_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, provider TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending', last_attempt_at TEXT, last_success_at TEXT,
 last_error_code TEXT, failure_count INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT, lease_token TEXT, lease_until TEXT,
 range_from TEXT, range_to TEXT, rows_written INTEGER NOT NULL DEFAULT 0
);
