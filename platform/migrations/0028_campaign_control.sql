-- Reserve an operation before contacting Meta. A lost response never authorizes
-- a blind retry, and only one unresolved write per real account/campaign exists.
CREATE TABLE campaign_operations (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES projects(id),
 integration_id TEXT NOT NULL,
 account_id TEXT NOT NULL,
 campaign_id TEXT NOT NULL,
 campaign_key TEXT NOT NULL,
 campaign_name TEXT NOT NULL,
 actor_ref TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 before_status TEXT NOT NULL,
 target_status TEXT NOT NULL CHECK(target_status IN ('ACTIVE','PAUSED')),
 observed_status TEXT,
 state TEXT NOT NULL CHECK(state IN ('checking','writing','uncertain','succeeded','rejected','unconfirmed')),
 error_code TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX campaign_operation_inflight ON campaign_operations(account_id,campaign_id)
 WHERE state IN ('checking','writing','uncertain');
CREATE INDEX campaign_operation_project_time ON campaign_operations(project_id,created_at DESC);
