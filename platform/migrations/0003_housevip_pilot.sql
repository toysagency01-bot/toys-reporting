-- HOUSEVIP pilot: non-sensitive advertising data only.
-- Lead PII is deliberately excluded from version control and must be imported
-- directly into D1 by an authenticated server-side job.

UPDATE projects
   SET currency = 'IDR',
       status = 'active',
       settings_json = '{"primaryDisplayCurrency":"EUR","sourceCurrency":"IDR","pilot":true}',
       updated_at = datetime('now')
 WHERE id = 'prj_housevip_cxp7';

INSERT INTO integrations
  (id, project_id, provider, external_account_id, status, sync_from_date, config_json)
VALUES
  ('int_housevip_meta', 'prj_housevip_cxp7', 'meta_ads', '1048983453973218', 'active', '2026-09-25',
   '{"source":"legacy_google_sheets","mode":"pilot"}')
ON CONFLICT(project_id, provider, external_account_id) DO UPDATE SET
  status = excluded.status,
  sync_from_date = excluded.sync_from_date,
  config_json = excluded.config_json,
  updated_at = datetime('now');

INSERT INTO campaigns
  (id, project_id, provider, external_campaign_id, name, status, currency, first_seen_at, last_seen_at)
VALUES
  ('cmp_housevip_meta_20260925', 'prj_housevip_cxp7', 'meta_ads', 'legacy:toys-tof-abo-fb-lead-20260925',
   'Toys/TOF/ABO/FB lead/ static+video - 25.09.26', 'active', 'IDR', '2026-09-25', '2026-09-27')
ON CONFLICT(project_id, provider, external_campaign_id) DO UPDATE SET
  name = excluded.name,
  status = excluded.status,
  currency = excluded.currency,
  first_seen_at = excluded.first_seen_at,
  last_seen_at = excluded.last_seen_at;

INSERT INTO ad_metrics_daily
  (project_id, provider, external_campaign_id, metric_date, currency, impressions, clicks, spend, leads, conversions, source_hash)
VALUES
  ('prj_housevip_cxp7', 'meta_ads', 'legacy:toys-tof-abo-fb-lead-20260925', '2026-09-25', 'IDR', 1248, 56, 345154, 3, 3, 'housevip-meta-2026-09-25-v1'),
  ('prj_housevip_cxp7', 'meta_ads', 'legacy:toys-tof-abo-fb-lead-20260925', '2026-09-26', 'IDR', 2575, 119, 771770, 5, 5, 'housevip-meta-2026-09-26-v1'),
  ('prj_housevip_cxp7', 'meta_ads', 'legacy:toys-tof-abo-fb-lead-20260925', '2026-09-27', 'IDR', 2357, 117, 758966, 8, 8, 'housevip-meta-2026-09-27-v1')
ON CONFLICT(project_id, provider, external_campaign_id, metric_date) DO UPDATE SET
  currency = excluded.currency,
  impressions = excluded.impressions,
  clicks = excluded.clicks,
  spend = excluded.spend,
  leads = excluded.leads,
  conversions = excluded.conversions,
  source_hash = excluded.source_hash,
  imported_at = datetime('now');
