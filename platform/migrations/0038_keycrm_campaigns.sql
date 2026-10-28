ALTER TABLE keycrm_cards ADD COLUMN campaign_provider TEXT;
ALTER TABLE keycrm_cards ADD COLUMN campaign_account_id TEXT;
ALTER TABLE keycrm_cards ADD COLUMN campaign_id TEXT;
ALTER TABLE keycrm_cards ADD COLUMN attribution_state TEXT;
ALTER TABLE keycrm_sync ADD COLUMN scan_attribution_revision TEXT;
ALTER TABLE keycrm_sync ADD COLUMN attribution_revision TEXT;
