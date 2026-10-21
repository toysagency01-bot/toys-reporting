-- Overrides preserve existing primary/custom board IDs and all lead history.
CREATE TABLE crm_board_settings (
 project_id TEXT NOT NULL REFERENCES projects(id),
 board_key TEXT NOT NULL,
 name TEXT NOT NULL,
 pipeline_json TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 0,
 claim_token TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL,
 PRIMARY KEY(project_id,board_key)
);
