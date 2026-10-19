ALTER TABLE crm_projects ADD COLUMN access_mode TEXT NOT NULL DEFAULT 'members' CHECK(access_mode IN ('members','admin'));
ALTER TABLE crm_projects ADD COLUMN capi_from TEXT;
ALTER TABLE crm_projects ADD COLUMN capi_kinds TEXT NOT NULL DEFAULT 'qualified,sale';
ALTER TABLE crm_projects ADD COLUMN capi_setup_state TEXT;
ALTER TABLE crm_projects ADD COLUMN capi_setup_error TEXT;

-- Only explicitly configured sources are processed. Cursors contain no contacts.
CREATE TABLE crm_meta_sources (
 page_id TEXT PRIMARY KEY REFERENCES crm_pages(page_id),
 project_id TEXT NOT NULL REFERENCES projects(id), account_id TEXT NOT NULL, app_id TEXT NOT NULL,
 live_since TEXT NOT NULL, history_from TEXT NOT NULL, history_to TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','error','paused')),
 last_error TEXT, attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT NOT NULL, lease_token TEXT, lease_until TEXT,
 forms_cursor TEXT, forms_checked_at TEXT, connected_at TEXT, last_scan_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE crm_meta_forms (
 page_id TEXT NOT NULL REFERENCES crm_meta_sources(page_id), form_id TEXT NOT NULL,
 name TEXT NOT NULL, cursor TEXT, scan_from TEXT, scan_to TEXT,
 history_finished_at TEXT, last_scan_at TEXT, next_scan_at TEXT NOT NULL,
 discovered_at TEXT NOT NULL, PRIMARY KEY(page_id,form_id)
);
CREATE INDEX crm_meta_forms_due ON crm_meta_forms(page_id,next_scan_at);
