-- NULL board_id is the existing primary board; no lead/status history is rewritten.
CREATE TABLE crm_boards (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES projects(id),
 name TEXT NOT NULL,
 pipeline_json TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(project_id,name COLLATE NOCASE)
);
ALTER TABLE leads ADD COLUMN board_id TEXT REFERENCES crm_boards(id);
CREATE INDEX leads_project_board_status ON leads(project_id,board_id,current_status,created_at);
