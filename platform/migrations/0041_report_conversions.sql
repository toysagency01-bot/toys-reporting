CREATE TABLE report_conversion_snapshots (
 project_id TEXT NOT NULL REFERENCES projects(id),source_hash TEXT NOT NULL,
 rows_json TEXT NOT NULL CHECK(json_valid(rows_json)),captured_at TEXT NOT NULL,
 PRIMARY KEY(project_id,source_hash)
);
CREATE TABLE report_conversion_state (
 project_id TEXT PRIMARY KEY REFERENCES projects(id),source_hash TEXT NOT NULL,
 checked_at TEXT NOT NULL,status TEXT NOT NULL,last_error TEXT
);
