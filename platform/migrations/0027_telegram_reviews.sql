CREATE TABLE IF NOT EXISTS agency_telegram_config (
 organization_id TEXT PRIMARY KEY,
 chat_id TEXT NOT NULL,
 bot_username TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','blocked')),
 chat_title TEXT, verified_at TEXT, error_code TEXT,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agency_telegram_deliveries (
 organization_id TEXT NOT NULL,
 delivery_key TEXT NOT NULL,
 chat_id TEXT NOT NULL,
 bot_username TEXT NOT NULL,
 messages_json TEXT NOT NULL CHECK(json_valid(messages_json)),
 message_ids_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(message_ids_json)),
 next_part INTEGER NOT NULL DEFAULT 0,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','blocked','uncertain')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT,
 lease_token TEXT, lease_until TEXT,
 error_code TEXT, created_at TEXT NOT NULL, sent_at TEXT,
 PRIMARY KEY(organization_id,delivery_key)
);
