CREATE TABLE manual_lead_counts (
 project_id TEXT NOT NULL REFERENCES projects(id),lead_date TEXT NOT NULL,
 lead_count INTEGER NOT NULL CHECK(lead_count>=0 AND lead_count<=1000000),
 booking_count INTEGER NOT NULL CHECK(booking_count>=0 AND booking_count<=1000000),
 version INTEGER NOT NULL,claim_token TEXT NOT NULL,
 updated_at TEXT NOT NULL,updated_by TEXT NOT NULL,
 PRIMARY KEY(project_id,lead_date)
);
CREATE TABLE manual_lead_count_writes (
 project_id TEXT NOT NULL REFERENCES projects(id),request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,response_json TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(project_id,request_key)
);
