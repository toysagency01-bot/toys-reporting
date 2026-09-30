-- AM Klinika: register both advertising accounts and activate the D1 dashboard.
-- No access tokens or lead PII are stored in this migration.

UPDATE projects
   SET name = 'AM Klinika',
       project_type = 'leadgen',
       currency = 'CZK',
       timezone = 'Europe/Prague',
       status = 'active',
       settings_json = '{"dataBackend":"d1","crmBackend":"d1","projectBackend":"d1","weeklyBackend":"d1","legacyBackup":"google_sheets","metaSync":"pending_authorization","googleSync":"pending_authorization","leadStatuses":["Новый","Не удалось связаться","Связались","Квалифицирован","Диагностика назначена","Автомобиль принят","Смета отправлена","Согласовано","В работе","Готов к выдаче","Завершён","Отложен","Неактуален"]}',
       updated_at = datetime('now')
 WHERE id = 'prj_amklinika_k8m2';

INSERT INTO integrations
  (id, project_id, provider, external_account_id, status, sync_from_date, config_json)
VALUES
  ('int_amklinika_meta', 'prj_amklinika_k8m2', 'meta_ads', '1830858661278666', 'pending', NULL,
   '{"source":"meta_graph_api","mode":"parallel_pending_authorization","legacyRuntimeUntouched":true}'),
  ('int_amklinika_google', 'prj_amklinika_k8m2', 'google_ads', '9632942627', 'pending', NULL,
   '{"source":"google_ads_api","displayAccountId":"963-294-2627","mode":"parallel_pending_authorization","legacyRuntimeUntouched":true}'),
  ('int_amklinika_sheets', 'prj_amklinika_k8m2', 'google_sheets', '1CUG7bljcemLqnKNq0nv4tpKtNGH4GDIbeQB2fDH5sSM', 'active', NULL,
   '{"purpose":"historical_lead_and_project_import","runtimeDependency":false,"legacyRuntimeUntouched":true}')
ON CONFLICT(project_id, provider, external_account_id) DO UPDATE SET
  status = excluded.status,
  sync_from_date = excluded.sync_from_date,
  config_json = excluded.config_json,
  updated_at = datetime('now');
