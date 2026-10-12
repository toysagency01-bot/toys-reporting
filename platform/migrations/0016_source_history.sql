-- Immutable, private source snapshots for migration and reconciliation.
-- No public route reads these tables. The importer excludes lead/contact tabs.
CREATE TABLE IF NOT EXISTS source_history_snapshots (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES projects(id),
 workbook_id TEXT NOT NULL,
 sheet_id INTEGER NOT NULL,
 sheet_title TEXT NOT NULL,
 source_hash TEXT NOT NULL,
 metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json)),
 captured_at TEXT NOT NULL,
 row_count INTEGER NOT NULL,
 cell_count INTEGER NOT NULL,
 page_count INTEGER NOT NULL,
 complete INTEGER NOT NULL DEFAULT 0 CHECK(complete IN (0,1)),
 UNIQUE(project_id,workbook_id,sheet_id,source_hash)
);
CREATE TABLE IF NOT EXISTS source_history_pages (
 snapshot_id TEXT NOT NULL REFERENCES source_history_snapshots(id),
 page_index INTEGER NOT NULL,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 payload_hash TEXT NOT NULL,
 PRIMARY KEY(snapshot_id,page_index)
);
