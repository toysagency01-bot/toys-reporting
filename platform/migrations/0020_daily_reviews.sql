CREATE TABLE IF NOT EXISTS agency_daily_reviews (
 organization_id TEXT NOT NULL, report_date TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('running','complete','partial','error')),
 attempts INTEGER NOT NULL DEFAULT 1, generated_at TEXT,
 next_attempt_at TEXT, lease_token TEXT, lease_until TEXT, error_code TEXT,
 PRIMARY KEY(organization_id,report_date)
);
CREATE TABLE IF NOT EXISTS agency_project_reviews (
 organization_id TEXT NOT NULL, report_date TEXT NOT NULL,
 project_id TEXT NOT NULL REFERENCES projects(id), priority TEXT NOT NULL,
 generated_at TEXT NOT NULL, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 PRIMARY KEY(organization_id,report_date,project_id)
);
CREATE INDEX IF NOT EXISTS idx_crm_milestones_project_date ON crm_milestones(project_id,occurred_at);
