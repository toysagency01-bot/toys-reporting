-- Contact-free snapshots. Only active_scan_id is visible to reporting.
CREATE TABLE keycrm_sync (
 project_id TEXT PRIMARY KEY REFERENCES projects(id),
 mapping_json TEXT,
 active_scan_id TEXT,
 scan_id TEXT,
 scan_started_at TEXT,
 next_page INTEGER NOT NULL DEFAULT 1,
 expected_total INTEGER,
 state TEXT NOT NULL DEFAULT 'pending',
 last_good_at TEXT,
 first_good_at TEXT,
 last_error TEXT,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT NOT NULL,
 lease_token TEXT,
 lease_until TEXT
);
CREATE TABLE keycrm_cards (
 project_id TEXT NOT NULL REFERENCES projects(id),
 scan_id TEXT NOT NULL,
 card_id TEXT NOT NULL,
 pipeline_id TEXT NOT NULL,
 status_id TEXT NOT NULL,
 received_at TEXT NOT NULL,
 received_date TEXT NOT NULL,
 qualified INTEGER NOT NULL CHECK(qualified IN (0,1)),
 first_qualified_observed_at TEXT,
 observed_at TEXT NOT NULL,
 present INTEGER NOT NULL DEFAULT 1 CHECK(present IN (0,1)),
 PRIMARY KEY(project_id,scan_id,card_id)
);
CREATE INDEX keycrm_cohort ON keycrm_cards(project_id,scan_id,received_date);
