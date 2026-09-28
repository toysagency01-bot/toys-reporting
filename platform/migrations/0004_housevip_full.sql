-- Complete HOUSEVIP migration. This schema contains no client PII.
-- Source rows are imported directly into D1 by the authenticated migration job.

CREATE TABLE project_tabs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('meta', 'smm', 'project')),
  tab_key TEXT NOT NULL,
  source_title TEXT NOT NULL,
  label TEXT NOT NULL,
  mode TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  content_json TEXT NOT NULL,
  raw_content_json TEXT,
  source_hash TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, tab_key)
);

CREATE INDEX project_tabs_project_idx ON project_tabs(project_id, channel, position);

UPDATE projects
   SET currency = 'IDR',
       timezone = 'Asia/Makassar',
       status = 'active',
       settings_json = '{"primaryDisplayCurrency":"EUR","sourceCurrency":"IDR","dataBackend":"d1","crmBackend":"d1","projectBackend":"d1","weeklyBackend":"d1","legacyBackup":"google_sheets","metaSync":"manual_until_authorized"}',
       updated_at = datetime('now')
 WHERE id = 'prj_housevip_cxp7';

UPDATE integrations
   SET status = 'pending',
       config_json = '{"source":"meta_graph_api","mode":"manual_until_authorized","legacyBackup":"google_sheets"}',
       updated_at = datetime('now')
 WHERE id = 'int_housevip_meta';

INSERT INTO integrations
  (id, project_id, provider, external_account_id, status, sync_from_date, config_json)
VALUES
  ('int_housevip_sheets_backup', 'prj_housevip_cxp7', 'google_sheets', 'housevip-legacy', 'disabled', '2026-09-25',
   '{"purpose":"migration_backup_only","runtimeDependency":false}')
ON CONFLICT(project_id, provider, external_account_id) DO UPDATE SET
  status = excluded.status,
  config_json = excluded.config_json,
  updated_at = datetime('now');
