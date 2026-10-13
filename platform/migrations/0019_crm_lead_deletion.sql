-- Retain source identity/history so a provider retry cannot resurrect a deleted lead.
ALTER TABLE leads ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS leads_crm_active ON leads(project_id,deleted_at,current_status,created_at);
