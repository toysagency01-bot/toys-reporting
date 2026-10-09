-- Local MVP vertical slice. This migration is additive: the six production
-- foundation migrations remain untouched and no existing table is rewritten.

PRAGMA foreign_keys = ON;

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, slug),
  UNIQUE (organization_id, id)
);

ALTER TABLE projects ADD COLUMN client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN capabilities_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE projects ADD COLUMN active_preset TEXT NOT NULL DEFAULT 'leadgen'
  CHECK (active_preset IN ('leadgen', 'ecommerce', 'instashop'));
ALTER TABLE projects ADD COLUMN default_locale TEXT NOT NULL DEFAULT 'ru';

CREATE UNIQUE INDEX projects_organization_id_unique ON projects(organization_id, id);

INSERT INTO clients (id, organization_id, slug, name)
VALUES ('client_housevip', 'org_toys_agency', 'housevip', 'HOUSEVIP')
ON CONFLICT(organization_id, slug) DO NOTHING;

UPDATE projects
   SET client_id = 'client_housevip',
       capabilities_json = '["ads","content","period_reports"]',
       active_preset = 'leadgen',
       default_locale = 'ru',
       updated_at = datetime('now')
 WHERE id = 'prj_housevip_cxp7';

CREATE TABLE project_channels (
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  channel_key TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (organization_id, project_id, channel_key),
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE
);

INSERT INTO project_channels (organization_id, project_id, channel_key, label) VALUES
  ('org_toys_agency', 'prj_housevip_cxp7', 'all', 'Все'),
  ('org_toys_agency', 'prj_housevip_cxp7', 'meta', 'Meta'),
  ('org_toys_agency', 'prj_housevip_cxp7', 'google', 'Google'),
  ('org_toys_agency', 'prj_housevip_cxp7', 'smm', 'SMM');

CREATE TABLE source_streams (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  channel_key TEXT NOT NULL,
  delivery_provider TEXT NOT NULL,
  business_provider TEXT NOT NULL,
  stable_source_ref TEXT NOT NULL,
  provider_account_ref TEXT,
  source_timezone TEXT NOT NULL,
  grain TEXT NOT NULL CHECK (grain IN ('campaign_daily', 'account_daily', 'project_daily')),
  source_schema_version TEXT NOT NULL,
  mapping_version TEXT NOT NULL,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, project_id, stable_source_ref),
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE data_generations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  source_stream_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('staging', 'sealed', 'quarantined', 'failed')),
  availability TEXT NOT NULL CHECK (availability IN ('not_configured', 'never_loaded', 'ok', 'error')),
  coverage TEXT NOT NULL CHECK (coverage IN ('complete', 'partial', 'unknown')),
  freshness TEXT NOT NULL CHECK (freshness IN ('fresh', 'stale')),
  requested_from TEXT,
  requested_to_exclusive TEXT,
  observed_from TEXT,
  observed_to_exclusive TEXT,
  row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  missing_ranges_json TEXT NOT NULL DEFAULT '[]',
  generated_at TEXT NOT NULL,
  sealed_at TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE (organization_id, project_id, idempotency_key),
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, project_id, source_stream_id)
    REFERENCES source_streams(organization_id, project_id, id) ON DELETE RESTRICT
);

CREATE TABLE fact_observations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  generation_id TEXT NOT NULL,
  source_stream_id TEXT NOT NULL,
  observation_key TEXT NOT NULL,
  local_date TEXT NOT NULL,
  source_timezone TEXT NOT NULL,
  reporting_date_basis TEXT NOT NULL DEFAULT 'source_local_date',
  grain TEXT NOT NULL CHECK (grain IN ('campaign_daily', 'account_daily', 'project_daily')),
  account_ref TEXT,
  provider_campaign_id TEXT,
  legacy_group_ref TEXT,
  legacy_campaign_label TEXT,
  source_record_ref TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (provider_campaign_id IS NULL OR legacy_group_ref IS NULL),
  UNIQUE (generation_id, observation_key),
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, project_id, generation_id)
    REFERENCES data_generations(organization_id, project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, project_id, source_stream_id)
    REFERENCES source_streams(organization_id, project_id, id) ON DELETE RESTRICT
);

CREATE INDEX fact_observations_project_date_idx
  ON fact_observations(organization_id, project_id, generation_id, local_date);

CREATE TABLE fact_values (
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  observation_id TEXT NOT NULL,
  metric_code TEXT NOT NULL,
  metric_version TEXT NOT NULL DEFAULT '1',
  value_basis TEXT NOT NULL DEFAULT 'source_native',
  value_text TEXT,
  scale INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  currency TEXT,
  value_state TEXT NOT NULL CHECK (value_state IN ('observed', 'missing', 'unsupported', 'unclassified')),
  quality_flags_json TEXT NOT NULL DEFAULT '[]',
  origin_refs_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (observation_id, metric_code, metric_version, value_basis),
  CHECK ((value_state = 'observed' AND value_text IS NOT NULL) OR
         (value_state <> 'observed' AND value_text IS NULL)),
  FOREIGN KEY (organization_id, project_id, observation_id)
    REFERENCES fact_observations(organization_id, project_id, id) ON DELETE CASCADE
);

CREATE TABLE project_data_releases (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  status TEXT NOT NULL DEFAULT 'sealed' CHECK (status = 'sealed'),
  manifest_json TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, project_id, revision),
  UNIQUE (organization_id, project_id, source_hash),
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE project_data_release_pointers (
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  pointer_revision INTEGER NOT NULL DEFAULT 1 CHECK (pointer_revision > 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (organization_id, project_id),
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, project_id, release_id)
    REFERENCES project_data_releases(organization_id, project_id, id) ON DELETE RESTRICT
);

CREATE TABLE dashboard_config_revisions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  revision_number INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  preset TEXT NOT NULL CHECK (preset IN ('leadgen', 'ecommerce', 'instashop')),
  config_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, project_id, revision_number),
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE dashboard_config_pointers (
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (organization_id, project_id),
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, project_id, revision_id)
    REFERENCES dashboard_config_revisions(organization_id, project_id, id) ON DELETE RESTRICT
);

CREATE TABLE content_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  channel_key TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'und',
  kind TEXT NOT NULL,
  logical_key TEXT NOT NULL,
  title TEXT NOT NULL,
  period_kind TEXT CHECK (period_kind IS NULL OR period_kind IN ('week', 'month', 'custom')),
  period_start TEXT,
  period_end TEXT,
  lifecycle TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active', 'archived')),
  latest_revision_number INTEGER NOT NULL DEFAULT 0 CHECK (latest_revision_number >= 0),
  published_revision_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, project_id, channel_key, locale, logical_key),
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE content_revisions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  content_item_id TEXT NOT NULL,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  parent_revision_id TEXT,
  block_schema_version TEXT NOT NULL DEFAULT '1',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  author_ref TEXT NOT NULL,
  reason TEXT,
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  data_snapshot_manifest_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (content_item_id, revision_number),
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id, content_item_id)
    REFERENCES content_items(organization_id, project_id, id) ON DELETE CASCADE
);

CREATE TABLE content_blocks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  block_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  block_type TEXT NOT NULL CHECK (block_type IN ('rich_text', 'task_list', 'period_summary', 'typed_table', 'metric_snapshot')),
  payload_schema_version TEXT NOT NULL DEFAULT '1',
  payload_json TEXT NOT NULL,
  UNIQUE (revision_id, block_key),
  FOREIGN KEY (organization_id, project_id, revision_id)
    REFERENCES content_revisions(organization_id, project_id, id) ON DELETE CASCADE
);

CREATE TABLE api_idempotency_keys (
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  action TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (organization_id, project_id, action, idempotency_key),
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE
);

INSERT INTO dashboard_config_revisions
  (id, organization_id, project_id, revision_number, schema_version, preset, config_json, status)
VALUES
  ('cfg_housevip_1', 'org_toys_agency', 'prj_housevip_cxp7', 1, 'toys-dashboard-config/1.0', 'leadgen',
   '{"defaultView":"metrics","panels":["spend","impressions","clicks","ctr","reportedConversions","cpa"],"currencyPolicy":"native","contentNavigation":["meta","smm"]}',
   'published');

INSERT INTO dashboard_config_pointers (organization_id, project_id, revision_id)
VALUES ('org_toys_agency', 'prj_housevip_cxp7', 'cfg_housevip_1');
