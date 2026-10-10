-- Recovered schema only; no project data. Do not apply to remote databases.
PRAGMA foreign_keys=OFF;
CREATE TABLE ad_metrics_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('meta_ads', 'google_ads')),
  external_campaign_id TEXT NOT NULL DEFAULT '',
  metric_date TEXT NOT NULL,
  currency TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  spend REAL NOT NULL DEFAULT 0 CHECK (spend >= 0),
  leads REAL NOT NULL DEFAULT 0 CHECK (leads >= 0),
  conversions REAL NOT NULL DEFAULT 0 CHECK (conversions >= 0),
  add_to_cart REAL NOT NULL DEFAULT 0 CHECK (add_to_cart >= 0),
  checkouts REAL NOT NULL DEFAULT 0 CHECK (checkouts >= 0),
  purchases REAL NOT NULL DEFAULT 0 CHECK (purchases >= 0),
  revenue REAL NOT NULL DEFAULT 0 CHECK (revenue >= 0),
  source_hash TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, provider, external_campaign_id, metric_date)
);
CREATE TABLE ads_on_demand_cache (
  cache_key TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  integration_id TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('meta_ads', 'google_ads')),
  account_scope TEXT NOT NULL,
  account_timezone TEXT NOT NULL,
  range_from TEXT NOT NULL,
  range_to TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'ad' CHECK (level = 'ad'),
  metrics_json TEXT NOT NULL,
  mapping_revision TEXT NOT NULL,
  provider_api_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  last_good_payload_json TEXT,
  last_good_at TEXT,
  expires_at TEXT,
  last_attempt_at TEXT,
  last_attempt_status TEXT NOT NULL DEFAULT 'never'
    CHECK (last_attempt_status IN ('never', 'running', 'success', 'error', 'unsupported', 'missing')),
  last_error_code TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (range_from <= range_to),
  CHECK (
    (last_good_payload_json IS NULL AND last_good_at IS NULL AND expires_at IS NULL) OR
    (last_good_payload_json IS NOT NULL AND last_good_at IS NOT NULL AND expires_at IS NOT NULL)
  ),
  
  
  CHECK (
    expires_at IS NULL OR
    ((julianday(expires_at) - julianday(last_good_at)) * 1440.0 BETWEEN 0 AND 60.0001)
  ),
  UNIQUE (organization_id, project_id, integration_id, cache_key),
  FOREIGN KEY (organization_id, project_id)
    REFERENCES projects(organization_id, id) ON DELETE CASCADE
);
CREATE TABLE ads_on_demand_refresh_guards (
  integration_id TEXT PRIMARY KEY REFERENCES integrations(id) ON DELETE CASCADE,
  active_cache_key TEXT REFERENCES ads_on_demand_cache(cache_key) ON DELETE SET NULL,
  owner_token TEXT,
  last_started_at TEXT,
  lease_expires_at TEXT,
  CHECK (
    (owner_token IS NULL AND lease_expires_at IS NULL) OR
    (owner_token IS NOT NULL AND last_started_at IS NOT NULL AND lease_expires_at > last_started_at)
  )
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
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('meta_ads', 'google_ads')),
  external_campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  currency TEXT,
  first_seen_at TEXT,
  last_seen_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE (project_id, provider, external_campaign_id)
);
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
CREATE TABLE content_comments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  content_item_id TEXT NOT NULL,
  data_release_id TEXT NOT NULL,
  published_revision_id TEXT,
  author_ref TEXT NOT NULL CHECK (length(author_ref) BETWEEN 1 AND 500),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 3000),
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id, content_item_id)
    REFERENCES content_items(organization_id, project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, project_id, data_release_id)
    REFERENCES project_data_releases(organization_id, project_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, project_id, content_item_id, published_revision_id)
    REFERENCES content_revisions(organization_id, project_id, content_item_id, id) ON DELETE RESTRICT
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
CREATE TABLE content_publication_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  content_item_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('publish', 'save_publish', 'rollback')),
  revision_id TEXT NOT NULL,
  previous_revision_id TEXT,
  source_revision_id TEXT,
  actor_ref TEXT NOT NULL,
  reason TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, project_id, content_item_id, event_type, idempotency_key),
  FOREIGN KEY (organization_id, project_id, content_item_id)
    REFERENCES content_items(organization_id, project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, project_id, revision_id)
    REFERENCES content_revisions(organization_id, project_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, project_id, previous_revision_id)
    REFERENCES content_revisions(organization_id, project_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, project_id, source_revision_id)
    REFERENCES content_revisions(organization_id, project_id, id) ON DELETE RESTRICT
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
CREATE TABLE creative_assets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
  media_type TEXT NOT NULL CHECK (length(media_type) BETWEEN 1 AND 100),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  storage_provider TEXT NOT NULL DEFAULT 'none'
    CHECK (storage_provider IN ('none', 'r2', 'kv')),
  storage_key TEXT,
  upload_state TEXT NOT NULL DEFAULT 'storage_unavailable'
    CHECK (upload_state IN ('storage_unavailable', 'pending', 'ready', 'failed')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved', 'rejected', 'archived')),
  status_version INTEGER NOT NULL DEFAULT 1 CHECK (status_version > 0),
  created_by TEXT NOT NULL CHECK (length(created_by) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, project_id, id),
  CHECK ((storage_provider = 'none' AND storage_key IS NULL AND upload_state = 'storage_unavailable')
      OR (storage_provider <> 'none' AND storage_key IS NOT NULL)),
  CHECK ((kind = 'image' AND duration_ms IS NULL) OR kind = 'video'),
  FOREIGN KEY (organization_id, project_id)
    REFERENCES projects(organization_id, id) ON DELETE CASCADE
);
CREATE TABLE creative_comments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  creative_asset_id TEXT NOT NULL,
  author_ref TEXT NOT NULL CHECK (length(author_ref) BETWEEN 1 AND 500),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 3000),
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id, creative_asset_id)
    REFERENCES creative_assets(organization_id, project_id, id) ON DELETE CASCADE
);
CREATE TABLE creative_status_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  creative_asset_id TEXT NOT NULL,
  from_status TEXT NOT NULL CHECK (from_status IN ('draft', 'in_review', 'approved', 'rejected', 'archived')),
  to_status TEXT NOT NULL CHECK (to_status IN ('draft', 'in_review', 'approved', 'rejected', 'archived')),
  status_version INTEGER NOT NULL CHECK (status_version > 1),
  actor_ref TEXT NOT NULL CHECK (length(actor_ref) BETWEEN 1 AND 500),
  reason TEXT CHECK (reason IS NULL OR length(reason) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, project_id, creative_asset_id, status_version),
  FOREIGN KEY (organization_id, project_id, creative_asset_id)
    REFERENCES creative_assets(organization_id, project_id, id) ON DELETE CASCADE
);
CREATE TABLE creative_storage_objects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  creative_asset_id TEXT NOT NULL,
  reservation_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'r2'),
  object_key TEXT NOT NULL,
  actual_bytes INTEGER NOT NULL CHECK (actual_bytes >= 0),
  etag TEXT,
  verified_at TEXT NOT NULL,
  UNIQUE (organization_id, project_id, creative_asset_id),
  UNIQUE (provider, object_key),
  FOREIGN KEY (organization_id, project_id, creative_asset_id)
    REFERENCES creative_assets(organization_id, project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (reservation_id)
    REFERENCES creative_storage_reservations(id) ON DELETE RESTRICT
);
CREATE TABLE creative_storage_operation_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  billing_month TEXT NOT NULL CHECK (billing_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  operation_class TEXT NOT NULL CHECK (operation_class IN ('class_a', 'class_b')),
  operation TEXT NOT NULL,
  creative_asset_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id)
    REFERENCES projects(organization_id, id) ON DELETE CASCADE
);
CREATE TABLE creative_storage_quotas (
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  max_stored_bytes INTEGER NOT NULL CHECK (max_stored_bytes > 0),
  max_object_bytes INTEGER NOT NULL CHECK (max_object_bytes > 0 AND max_object_bytes <= max_stored_bytes),
  max_monthly_class_a_ops INTEGER NOT NULL CHECK (max_monthly_class_a_ops >= 0),
  max_monthly_class_b_ops INTEGER NOT NULL CHECK (max_monthly_class_b_ops >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, project_id),
  FOREIGN KEY (organization_id, project_id)
    REFERENCES projects(organization_id, id) ON DELETE CASCADE
);
CREATE TABLE creative_storage_reservations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  creative_asset_id TEXT NOT NULL,
  reserved_bytes INTEGER NOT NULL CHECK (reserved_bytes > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'committed', 'released')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  finished_at TEXT,
  CHECK (expires_at > created_at),
  CHECK ((status = 'active' AND finished_at IS NULL) OR (status <> 'active' AND finished_at IS NOT NULL)),
  UNIQUE (organization_id, project_id, creative_asset_id, id),
  FOREIGN KEY (organization_id, project_id, creative_asset_id)
    REFERENCES creative_assets(organization_id, project_id, id) ON DELETE CASCADE
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
CREATE TABLE exchange_rates (
  rate_date TEXT NOT NULL,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate REAL NOT NULL CHECK (rate > 0),
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (rate_date, base_currency, quote_currency)
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
CREATE TABLE google_ads_receiver_batches (
  snapshot_id TEXT PRIMARY KEY CHECK (length(snapshot_id) = 64),
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  customer_id TEXT NOT NULL CHECK (length(customer_id) = 10),
  login_customer_id TEXT NOT NULL CHECK (length(login_customer_id) = 10),
  api_version TEXT NOT NULL,
  range_from TEXT NOT NULL,
  range_to TEXT NOT NULL,
  currency_code TEXT NOT NULL CHECK (length(currency_code) = 3),
  time_zone TEXT NOT NULL,
  page_size INTEGER NOT NULL CHECK (page_size BETWEEN 1 AND 5000),
  total_rows INTEGER NOT NULL CHECK (total_rows >= 0),
  campaign_rows INTEGER NOT NULL CHECK (campaign_rows >= 0),
  ad_group_rows INTEGER NOT NULL CHECK (ad_group_rows >= 0),
  ad_rows INTEGER NOT NULL CHECK (ad_rows >= 0),
  next_expected_offset INTEGER NOT NULL DEFAULT 0 CHECK (next_expected_offset >= 0),
  received_rows INTEGER NOT NULL DEFAULT 0 CHECK (received_rows >= 0),
  status TEXT NOT NULL DEFAULT 'receiving' CHECK (status IN ('receiving', 'accepted', 'rejected')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  accepted_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT
);
CREATE TABLE google_ads_receiver_pages (
  snapshot_id TEXT NOT NULL REFERENCES google_ads_receiver_batches(snapshot_id) ON DELETE CASCADE,
  page_offset INTEGER NOT NULL CHECK (page_offset >= 0),
  page_hash TEXT NOT NULL CHECK (length(page_hash) = 64),
  row_count INTEGER NOT NULL CHECK (row_count >= 0),
  has_next INTEGER NOT NULL CHECK (has_next IN (0, 1)),
  received_at TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, page_offset)
);
CREATE TABLE google_ads_receiver_rows (
  snapshot_id TEXT NOT NULL REFERENCES google_ads_receiver_batches(snapshot_id) ON DELETE CASCADE,
  row_key TEXT NOT NULL,
  page_offset INTEGER NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('campaign', 'ad_group', 'ad')),
  metric_date TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  ad_group_id TEXT,
  ad_id TEXT,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, row_key),
  FOREIGN KEY (snapshot_id, page_offset)
    REFERENCES google_ads_receiver_pages(snapshot_id, page_offset) ON DELETE CASCADE
);
CREATE TABLE integrations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('meta_ads', 'google_ads', 'google_sheets', 'manual', 'currency')),
  external_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error', 'disabled')),
  secret_ref TEXT,
  sync_from_date TEXT,
  last_success_at TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, provider, external_account_id)
);
CREATE TABLE lead_comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE lead_status_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT
);
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_provider TEXT NOT NULL,
  external_lead_id TEXT NOT NULL,
  campaign_external_id TEXT,
  created_at TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  contact_method TEXT,
  budget TEXT,
  current_status TEXT NOT NULL DEFAULT 'Новый',
  status_updated_at TEXT,
  assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, source_provider, external_lead_id)
);
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
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
CREATE TABLE project_memberships (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('agency_admin', 'buyer', 'client_owner', 'client_manager', 'client_viewer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, user_id)
);
CREATE TABLE "project_tabs" (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('meta', 'google', 'smm', 'project')),
  tab_key TEXT NOT NULL,
  source_title TEXT NOT NULL,
  label TEXT NOT NULL,
  mode TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  content_json TEXT NOT NULL,
  raw_content_json TEXT,
  source_hash TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, tab_key)
);
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  project_type TEXT NOT NULL DEFAULT 'unconfigured'
    CHECK (project_type IN ('unconfigured', 'leadgen', 'ecommerce', 'instashop', 'agency')),
  currency TEXT,
  timezone TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
  legacy_slug TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
, client_id TEXT REFERENCES clients(id) ON DELETE SET NULL, capabilities_json TEXT NOT NULL DEFAULT '[]', active_preset TEXT NOT NULL DEFAULT 'leadgen'
  CHECK (active_preset IN ('leadgen', 'ecommerce', 'instashop')), default_locale TEXT NOT NULL DEFAULT 'ru');
CREATE TABLE sales (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  external_sale_id TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  sale_date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'refunded')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, source, external_sale_id)
);
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
CREATE TABLE sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'warning', 'error', 'skipped')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  rows_read INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  details_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);
CREATE TABLE weekly_reports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  summary TEXT NOT NULL,
  wins TEXT,
  issues TEXT,
  changes TEXT,
  next_steps TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, period_start, period_end)
);
CREATE INDEX ad_metrics_project_date_idx ON ad_metrics_daily(project_id, metric_date, provider);
CREATE INDEX ads_on_demand_cache_lookup_idx
  ON ads_on_demand_cache(organization_id, project_id, integration_id, range_from, range_to);
CREATE INDEX ads_on_demand_refresh_guards_expiry_idx
  ON ads_on_demand_refresh_guards(lease_expires_at);
CREATE INDEX audit_log_project_idx ON audit_log(project_id, created_at DESC);
CREATE INDEX campaigns_project_idx ON campaigns(project_id, provider, status);
CREATE INDEX content_comments_item_newest_idx
  ON content_comments(organization_id, project_id, content_item_id, created_at DESC, id DESC);
CREATE INDEX content_comments_release_idx
  ON content_comments(organization_id, project_id, data_release_id, created_at DESC);
CREATE INDEX content_publication_events_item_created_idx
  ON content_publication_events(organization_id, project_id, content_item_id, created_at);
CREATE UNIQUE INDEX content_revisions_item_scope_unique
  ON content_revisions(organization_id, project_id, content_item_id, id);
CREATE INDEX creative_assets_project_newest_idx
  ON creative_assets(organization_id, project_id, created_at DESC, id DESC);
CREATE INDEX creative_assets_project_status_idx
  ON creative_assets(organization_id, project_id, status, created_at DESC, id DESC);
CREATE INDEX creative_comments_asset_newest_idx
  ON creative_comments(organization_id, project_id, creative_asset_id, created_at DESC, id DESC);
CREATE INDEX creative_status_events_asset_idx
  ON creative_status_events(organization_id, project_id, creative_asset_id, status_version DESC);
CREATE INDEX creative_storage_active_reservations_idx
  ON creative_storage_reservations(organization_id, project_id, status, expires_at);
CREATE INDEX creative_storage_objects_usage_idx
  ON creative_storage_objects(organization_id, project_id, actual_bytes);
CREATE UNIQUE INDEX creative_storage_one_active_reservation_idx
  ON creative_storage_reservations(organization_id, project_id, creative_asset_id)
  WHERE status = 'active';
CREATE INDEX creative_storage_operation_budget_idx
  ON creative_storage_operation_events(organization_id, project_id, billing_month, operation_class);
CREATE INDEX fact_observations_project_date_idx
  ON fact_observations(organization_id, project_id, generation_id, local_date);
CREATE INDEX google_ads_receiver_batches_project_idx
  ON google_ads_receiver_batches(organization_id, project_id, created_at DESC);
CREATE INDEX google_ads_receiver_rows_readback_idx
  ON google_ads_receiver_rows(snapshot_id, level, metric_date);
CREATE INDEX lead_comments_lead_idx ON lead_comments(lead_id, created_at);
CREATE INDEX lead_status_events_lead_idx ON lead_status_events(lead_id, changed_at);
CREATE INDEX leads_project_phone_idx ON leads(project_id, phone);
CREATE INDEX leads_project_status_idx ON leads(project_id, current_status, created_at);
CREATE INDEX project_memberships_user_idx ON project_memberships(user_id, project_id);
CREATE INDEX project_tabs_project_idx ON project_tabs(project_id, channel, position);
CREATE UNIQUE INDEX projects_organization_id_unique ON projects(organization_id, id);
CREATE INDEX projects_organization_idx ON projects(organization_id, status);
CREATE INDEX sales_project_date_idx ON sales(project_id, sale_date, status);
CREATE INDEX sync_runs_project_idx ON sync_runs(project_id, started_at DESC);
CREATE TRIGGER content_blocks_immutable_delete
BEFORE DELETE ON content_blocks
BEGIN
  SELECT RAISE(ABORT, 'content_blocks_are_immutable');
END;
CREATE TRIGGER content_blocks_immutable_update
BEFORE UPDATE ON content_blocks
BEGIN
  SELECT RAISE(ABORT, 'content_blocks_are_immutable');
END;
PRAGMA foreign_keys=ON;
