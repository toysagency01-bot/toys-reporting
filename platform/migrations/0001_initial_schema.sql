PRAGMA foreign_keys = ON;

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
);

CREATE INDEX projects_organization_idx ON projects(organization_id, status);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE project_memberships (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('agency_admin', 'buyer', 'client_owner', 'client_manager', 'client_viewer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX project_memberships_user_idx ON project_memberships(user_id, project_id);

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

CREATE INDEX campaigns_project_idx ON campaigns(project_id, provider, status);

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

CREATE INDEX ad_metrics_project_date_idx ON ad_metrics_daily(project_id, metric_date, provider);

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

CREATE INDEX leads_project_status_idx ON leads(project_id, current_status, created_at);
CREATE INDEX leads_project_phone_idx ON leads(project_id, phone);

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

CREATE INDEX lead_status_events_lead_idx ON lead_status_events(lead_id, changed_at);

CREATE TABLE lead_comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX lead_comments_lead_idx ON lead_comments(lead_id, created_at);

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

CREATE INDEX sales_project_date_idx ON sales(project_id, sale_date, status);

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

CREATE TABLE exchange_rates (
  rate_date TEXT NOT NULL,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate REAL NOT NULL CHECK (rate > 0),
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (rate_date, base_currency, quote_currency)
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

CREATE INDEX sync_runs_project_idx ON sync_runs(project_id, started_at DESC);

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

CREATE INDEX audit_log_project_idx ON audit_log(project_id, created_at DESC);

