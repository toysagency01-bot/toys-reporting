-- File bytes live only in private R2; D1 holds ownership, readiness and quota metadata.
CREATE TABLE IF NOT EXISTS report_attachments (
 organization_id TEXT NOT NULL,
 project_id TEXT NOT NULL REFERENCES projects(id),
 id TEXT NOT NULL,
 media_type TEXT NOT NULL CHECK(media_type IN ('image/png','image/jpeg','image/webp')),
 byte_size INTEGER NOT NULL CHECK(byte_size > 0 AND byte_size <= 8388608),
 ready INTEGER NOT NULL DEFAULT 0 CHECK(ready IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(organization_id,project_id,id)
);
