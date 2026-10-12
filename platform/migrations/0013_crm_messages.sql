CREATE TABLE IF NOT EXISTS crm_channels (
 provider TEXT NOT NULL CHECK(provider IN ('instagram','whatsapp')),
 external_id TEXT NOT NULL, name TEXT NOT NULL, project_id TEXT REFERENCES projects(id),
 app_secret_cipher TEXT, discovered_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(provider,external_id)
);
CREATE TABLE IF NOT EXISTS crm_messages (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
 lead_id TEXT NOT NULL REFERENCES leads(id), provider TEXT NOT NULL,
 channel_id TEXT NOT NULL, provider_message_id TEXT NOT NULL,
 text TEXT NOT NULL, message_type TEXT NOT NULL, occurred_at TEXT NOT NULL,
 referral_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL,
 UNIQUE(provider,channel_id,provider_message_id)
);
CREATE INDEX IF NOT EXISTS crm_messages_lead ON crm_messages(project_id,lead_id,occurred_at);
