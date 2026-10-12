CREATE TABLE IF NOT EXISTS crm_projects (
 project_id TEXT PRIMARY KEY REFERENCES projects(id), enabled_at TEXT NOT NULL,
 timezone TEXT NOT NULL, website_key_hash TEXT, dataset_id TEXT,
 capi_token_cipher TEXT, capi_enabled INTEGER NOT NULL DEFAULT 0,
 qualified_event TEXT NOT NULL DEFAULT 'QualifiedLead', sale_event TEXT NOT NULL DEFAULT 'ConvertedLead',
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS crm_lead_state (
 lead_id TEXT PRIMARY KEY REFERENCES leads(id), version INTEGER NOT NULL DEFAULT 1,
 qualified_at TEXT, sold_at TEXT, sale_value TEXT, sale_currency TEXT,
 owner_label TEXT, claim_token TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS crm_milestones (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), lead_id TEXT NOT NULL REFERENCES leads(id),
 kind TEXT NOT NULL CHECK(kind IN ('qualified','sale')), occurred_at TEXT NOT NULL,
 value TEXT, currency TEXT, UNIQUE(lead_id,kind)
);
CREATE TABLE IF NOT EXISTS crm_delivery (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), lead_id TEXT REFERENCES leads(id),
 kind TEXT NOT NULL CHECK(kind IN ('meta_lead','capi')), source_id TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','sent','blocked','error')),
 payload_json TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL,
 lease_until TEXT, last_error TEXT, sent_at TEXT, created_at TEXT NOT NULL,
 UNIQUE(project_id,kind,source_id)
);
CREATE INDEX IF NOT EXISTS crm_delivery_due ON crm_delivery(state,next_attempt_at);
CREATE TABLE IF NOT EXISTS crm_pages (
 page_id TEXT PRIMARY KEY, name TEXT NOT NULL, project_id TEXT REFERENCES projects(id),
 token_cipher TEXT, app_id TEXT, app_secret_cipher TEXT,
 subscribed INTEGER NOT NULL DEFAULT 0, discovered_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS crm_write_keys (
 project_id TEXT NOT NULL, request_key TEXT NOT NULL, request_hash TEXT NOT NULL,
 response_json TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(project_id,request_key)
);
CREATE TABLE IF NOT EXISTS crm_meta_inbox (
 page_id TEXT NOT NULL REFERENCES crm_pages(page_id), leadgen_id TEXT NOT NULL,
 received_at TEXT NOT NULL, PRIMARY KEY(page_id,leadgen_id)
);
CREATE TABLE IF NOT EXISTS crm_agent_credentials (
 id TEXT PRIMARY KEY CHECK(id='toys-media-buyer'), token_cipher TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS crm_agent_accounts (
 account_id TEXT PRIMARY KEY, name TEXT NOT NULL, pixels_json TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL
);
