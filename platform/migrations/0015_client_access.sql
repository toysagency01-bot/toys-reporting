-- Existing users and memberships remain intact. Access stores no passwords or OTPs.
ALTER TABLE users ADD COLUMN access_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN access_claim TEXT;
CREATE TABLE portal_access_writes (
 request_key TEXT PRIMARY KEY,
 request_hash TEXT NOT NULL,
 response_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
