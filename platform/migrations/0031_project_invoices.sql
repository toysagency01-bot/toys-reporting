CREATE TABLE project_invoice_defaults (
 project_id TEXT PRIMARY KEY REFERENCES projects(id), data_json TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, last_write_key TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE project_invoice_counters (
 project_id TEXT NOT NULL REFERENCES projects(id), year TEXT NOT NULL,
 next_number INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(project_id,year)
);
CREATE TABLE project_invoices (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
 number TEXT NOT NULL, number_key TEXT NOT NULL, data_json TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, duplicated_from TEXT,
 last_write_key TEXT NOT NULL, deleted_at TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(project_id,number_key)
);
CREATE INDEX project_invoices_list ON project_invoices(project_id,deleted_at,updated_at);
CREATE TABLE project_invoice_writes (
 project_id TEXT NOT NULL REFERENCES projects(id), request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL, entity_id TEXT NOT NULL, kind TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(project_id,request_key)
);
