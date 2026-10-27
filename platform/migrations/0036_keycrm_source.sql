-- Unknown legacy sources stay NULL and never qualify as agency-owned leads.
ALTER TABLE keycrm_cards ADD COLUMN utm_source TEXT CHECK(utm_source IS NULL OR utm_source='toys');
ALTER TABLE keycrm_sync ADD COLUMN scan_filter TEXT;
ALTER TABLE keycrm_sync ADD COLUMN source_filter TEXT;
