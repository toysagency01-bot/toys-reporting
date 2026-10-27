CREATE TABLE IF NOT EXISTS brief_sources (
 id TEXT PRIMARY KEY, spreadsheet_id TEXT NOT NULL, sheet_id INTEGER NOT NULL,
 sheet_name TEXT NOT NULL, timezone TEXT NOT NULL, drive_parent_id TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0, accept_from TEXT NOT NULL, last_checked_at TEXT, last_received_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(spreadsheet_id,sheet_id)
);
CREATE TABLE IF NOT EXISTS project_onboarding (
 project_id TEXT PRIMARY KEY REFERENCES projects(id), source_id TEXT NOT NULL REFERENCES brief_sources(id),
 response_key TEXT NOT NULL, request_hash TEXT NOT NULL, source_row INTEGER NOT NULL,
 submitted_at TEXT NOT NULL, briefing_json TEXT NOT NULL CHECK(json_valid(briefing_json)),
 profile_json TEXT NOT NULL CHECK(json_valid(profile_json)), checklist_json TEXT NOT NULL CHECK(json_valid(checklist_json)),
 drive_folder_id TEXT, version INTEGER NOT NULL DEFAULT 0, write_token TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(source_id,response_key)
);
