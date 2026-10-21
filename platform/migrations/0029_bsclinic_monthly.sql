-- Additive storage for the BSCLINIC monthly summary. No existing reports move or change.
CREATE TABLE IF NOT EXISTS project_monthly_reports (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES projects(id),
 period_start TEXT NOT NULL,
 period_end TEXT NOT NULL,
 currency TEXT NOT NULL CHECK(currency='CZK'),
 campaigns_json TEXT NOT NULL CHECK(json_valid(campaigns_json)),
 summary TEXT NOT NULL DEFAULT '',
 source_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(source_json)),
 version INTEGER NOT NULL DEFAULT 1,
 last_write_key TEXT,
 updated_by TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(project_id,period_start,period_end),
 CHECK(period_start<=period_end)
);
CREATE INDEX IF NOT EXISTS monthly_report_project_period ON project_monthly_reports(project_id,period_end DESC);
CREATE TABLE IF NOT EXISTS monthly_report_writes (
 project_id TEXT NOT NULL REFERENCES projects(id),
 request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 report_id TEXT NOT NULL REFERENCES project_monthly_reports(id),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(project_id,request_key)
);
