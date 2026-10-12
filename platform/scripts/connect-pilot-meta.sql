-- Existing account scopes verified against imported Meta source facts.
-- Reversible registration only: no credentials, reporting data or existing
-- integration statuses are overwritten. Roll back by disabling these two IDs.
INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json)
SELECT 'native-meta-'||p.slug,p.id,'meta_ads','526953126968211','active',
 '{"accountTimezone":"Asia/Tbilisi","expectedCurrency":"CZK","apiVersion":"v26.0"}'
FROM projects p WHERE p.slug='karlovarska-sul-k4rm' AND EXISTS(
 SELECT 1 FROM fact_observations o JOIN fact_values v ON v.observation_id=o.id
 WHERE o.project_id=p.id AND o.account_ref='526953126968211' AND o.source_timezone='Asia/Tbilisi' AND v.metric_code='ads.spend' AND v.currency='CZK')
ON CONFLICT(project_id,provider,external_account_id) DO NOTHING;
INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json)
SELECT 'native-meta-'||p.slug,p.id,'meta_ads','394051718160331','active',
 '{"accountTimezone":"America/Los_Angeles","expectedCurrency":"USD","apiVersion":"v26.0"}'
FROM projects p WHERE p.slug='profkit-instashop-r4vk' AND EXISTS(
 SELECT 1 FROM fact_observations o JOIN fact_values v ON v.observation_id=o.id
 WHERE o.project_id=p.id AND o.account_ref='394051718160331' AND o.source_timezone='America/Los_Angeles' AND v.metric_code='ads.raw_spend_usd' AND v.currency='USD')
ON CONFLICT(project_id,provider,external_account_id) DO NOTHING;
