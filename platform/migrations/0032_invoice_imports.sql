CREATE TABLE invoice_import_records (
 id TEXT PRIMARY KEY,
 source TEXT NOT NULL, external_id TEXT NOT NULL, client_key TEXT NOT NULL,
 buyer_name TEXT NOT NULL, number TEXT NOT NULL, issue_date TEXT NOT NULL,
 currency TEXT NOT NULL, total TEXT NOT NULL, data_json TEXT,
 source_json TEXT NOT NULL, fingerprint TEXT NOT NULL, warnings_json TEXT NOT NULL,
 invoice_id TEXT UNIQUE REFERENCES project_invoices(id),
 original_key TEXT, original_sha256 TEXT, original_bytes INTEGER, original_ready INTEGER NOT NULL DEFAULT 0,
 imported_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(source,external_id)
);
CREATE INDEX invoice_import_client ON invoice_import_records(client_key,issue_date);
CREATE TABLE invoice_import_mappings (
 client_key TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE project_billing_profiles (
 project_id TEXT PRIMARY KEY REFERENCES projects(id),
 method TEXT NOT NULL CHECK(method IN ('invoice','crypto','mixed','unspecified')),
 note TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1, last_write_key TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
