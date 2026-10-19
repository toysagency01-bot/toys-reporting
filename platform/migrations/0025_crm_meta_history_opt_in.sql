-- Historical retrieval requires explicit project approval. Live reconciliation
-- starts at live_since even when old history bounds remain for audit purposes.
ALTER TABLE crm_meta_sources ADD COLUMN history_enabled INTEGER NOT NULL DEFAULT 0 CHECK(history_enabled IN (0,1));
