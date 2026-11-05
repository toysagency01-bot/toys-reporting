#!/usr/bin/env python3
"""Connect only the user-specified Reviews Plus Meta account.

prepare requests the existing read-only importer; confirm adopts independently
verified account metadata. Never modifies credentials, roles or campaigns.
"""
import datetime, json, pathlib, re, runpy, sys

c = runpy.run_path(str(pathlib.Path(__file__).with_name('configure-client-access.py')))
PROJECT = 'prj_reviews_plus'
ACCOUNT = '1004879622002632'
INTEGRATION = 'native-meta-reviews-plus'

def query(sql, params=None):
    if ';' in sql and params:
        # D1's HTTP API accepts parameters for a single statement only.
        values = iter(params)
        quote = lambda v: 'NULL' if v is None else "'" + str(v).replace("'", "''") + "'"
        sql = re.sub(r'\?', lambda _: quote(next(values)), sql)
        assert next(values, None) is None
        params = None
    result = c['api']('/d1/database/' + c['DB'] + '/query', 'POST', {'sql': sql, 'params': params or []})
    assert all(r['success'] for r in result)
    return result[0]['results']

def status():
    return query("""SELECT p.slug,i.external_account_id AS account,i.status,
      json_extract(i.config_json,'$.accountMetadataCheckedAt') AS verifiedAt,
      json_extract(i.config_json,'$.expectedCurrency') AS currency,
      json_extract(i.config_json,'$.accountTimezone') AS timezone,
      s.state,s.last_success_at,s.last_error_code,s.range_from,s.range_to,s.rows_written
      FROM projects p LEFT JOIN integrations i ON i.project_id=p.id AND i.id=?
      LEFT JOIN ads_import_status s ON s.integration_id=i.id WHERE p.id=?""", [INTEGRATION, PROJECT])

action = sys.argv[1] if len(sys.argv) > 1 else 'status'
assert action in ('prepare', 'confirm', 'refresh', 'status')
assert query('SELECT slug,status FROM projects WHERE id=?', [PROJECT]) == [{'slug': 'reviews-plus', 'status': 'active'}]
if action == 'prepare':
    assert not query("SELECT id FROM integrations WHERE provider='meta_ads' AND external_account_id=? AND project_id!=? AND status='active'", [ACCOUNT, PROJECT]), 'Account already in use'
    assert not query("SELECT project_id FROM project_setup_connections WHERE provider='meta_ads' AND account_id=? AND project_id!=?", [ACCOUNT, PROJECT]), 'Account already claimed'
    existing = query("SELECT id,external_account_id FROM integrations WHERE project_id=? AND provider='meta_ads'", [PROJECT])
    assert not existing or existing == [{'id': INTEGRATION, 'external_account_id': ACCOUNT}], 'Preserve unexpected existing integration'
    if not existing:
        assert not query("SELECT provider FROM project_setup_connections WHERE project_id=? AND provider='meta_ads'", [PROJECT]), 'Preserve existing setup'
        at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
        config = json.dumps({'verifyAccountMetadata': True, 'allowCurrencyDiscovery': True, 'apiVersion': 'v26.0', 'resultActionTypes': ['lead'], 'resultMode': 'adset_optimization', 'insightChunkDays': 1, 'reconcileAccountTotals': True, 'refreshRequestedAt': at})
        query("""INSERT INTO project_setup_connections(project_id,provider,account_id,state,config_json)
          VALUES(?,'meta_ads',?,'pending','{}');
          INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json)
          VALUES(?,?,'meta_ads',?,'active',?);""", [PROJECT, ACCOUNT, INTEGRATION, PROJECT, ACCOUNT, config])
if action == 'refresh':
    at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
    query("""UPDATE integrations SET config_json=json_set(config_json,
      '$.resultActionTypes',json('["lead"]'),'$.resultMode','adset_optimization',
      '$.insightChunkDays',1,'$.refreshRequestedAt',?)
      WHERE id=? AND project_id=? AND external_account_id=? AND status='active'""", [at, INTEGRATION, PROJECT, ACCOUNT])
if action == 'confirm':
    rows = query('SELECT config_json FROM integrations WHERE id=? AND project_id=? AND external_account_id=?', [INTEGRATION, PROJECT, ACCOUNT])
    assert len(rows) == 1
    config = json.loads(rows[0]['config_json'])
    assert config.get('accountMetadataCheckedAt'), 'Importer has not verified account access'
    assert query("SELECT state FROM ads_import_status WHERE integration_id=? AND last_success_at IS NOT NULL", [INTEGRATION]) == [{'state': 'success'}], 'First import must succeed'
    query("""UPDATE project_setup_connections SET state='connected',last_error=NULL,
      config_json=?,last_checked_at=? WHERE project_id=? AND provider='meta_ads' AND account_id=?;
      UPDATE projects SET currency=?,timezone=?,settings_json=json_remove(settings_json,'$.needsCurrency','$.needsTimezone') WHERE id=?;""",
      [json.dumps({'currency': config['expectedCurrency'], 'timezone': config['accountTimezone']}), config['accountMetadataCheckedAt'], PROJECT, ACCOUNT, config['expectedCurrency'], config['accountTimezone'], PROJECT])
print(json.dumps(status()))
