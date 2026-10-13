CREATE TABLE IF NOT EXISTS portal_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  password_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS portal_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  credential_version INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS portal_sessions_user ON portal_sessions(user_id);
CREATE INDEX IF NOT EXISTS portal_sessions_expiry ON portal_sessions(expires_at);
CREATE TABLE IF NOT EXISTS portal_invitations (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  claim TEXT
);
CREATE INDEX IF NOT EXISTS portal_invitations_user ON portal_invitations(user_id);
CREATE TABLE IF NOT EXISTS portal_login_limits (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
