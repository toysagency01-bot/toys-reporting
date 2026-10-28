CREATE TABLE project_setup_state (
 project_id TEXT PRIMARY KEY REFERENCES projects(id),
 name_key TEXT NOT NULL UNIQUE,
 setup_json TEXT NOT NULL CHECK(json_valid(setup_json)),
 version INTEGER NOT NULL DEFAULT 1,
 write_token TEXT,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE project_setup_writes (
 request_key TEXT PRIMARY KEY,actor_ref TEXT NOT NULL,request_hash TEXT NOT NULL,
 project_id TEXT NOT NULL REFERENCES projects(id),response_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE project_setup_connections (
 project_id TEXT NOT NULL REFERENCES projects(id),provider TEXT NOT NULL,
 account_id TEXT,token_cipher TEXT,config_json TEXT NOT NULL DEFAULT '{}',
 state TEXT NOT NULL DEFAULT 'pending',last_error TEXT,last_checked_at TEXT,
 PRIMARY KEY(project_id,provider)
);
CREATE UNIQUE INDEX project_setup_account_claim ON project_setup_connections(provider,account_id) WHERE account_id IS NOT NULL AND provider IN ('meta_ads','google_ads');
CREATE TABLE project_setup_crm_cards (
 project_id TEXT NOT NULL REFERENCES projects(id),scan_id TEXT NOT NULL,card_id TEXT NOT NULL,
 received_date TEXT NOT NULL,qualified_at TEXT NOT NULL,PRIMARY KEY(project_id,scan_id,card_id)
);
CREATE TABLE project_setup_crm_sync (
 project_id TEXT PRIMARY KEY REFERENCES projects(id),active_scan_id TEXT,scan_id TEXT,
 next_page INTEGER NOT NULL DEFAULT 1,expected_total INTEGER,seen INTEGER NOT NULL DEFAULT 0,
 state TEXT NOT NULL DEFAULT 'pending',last_good_at TEXT,last_error TEXT,next_attempt_at TEXT,
 lease_token TEXT,lease_until TEXT
);
CREATE TABLE project_setup_ad_rows (
 project_id TEXT NOT NULL REFERENCES projects(id),provider TEXT NOT NULL,
 metric_date TEXT NOT NULL,campaign_key TEXT NOT NULL,campaign_name TEXT NOT NULL,
 currency TEXT NOT NULL,impressions INTEGER NOT NULL,clicks INTEGER NOT NULL,
 spend REAL NOT NULL,conversions REAL,
 updated_at TEXT NOT NULL,PRIMARY KEY(project_id,provider,metric_date,campaign_key)
);
