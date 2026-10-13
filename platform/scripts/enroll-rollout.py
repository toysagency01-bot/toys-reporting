#!/usr/bin/env python3
"""Enroll only the seven reviewed projects for direct Meta onboarding imports.
Usage: python scripts/enroll-rollout.py PRIVATE_ROOT [--apply]
Does not publish board access, modify Cloud Run or replace existing Google setup.
"""
import importlib.util
import json
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
assert Path(__file__).resolve().parents[2] not in root.parents
plan = json.loads(Path('imports/rollout-20261013.json').read_text())
spec = importlib.util.spec_from_file_location('cf', Path(__file__).with_name('configure-client-access.py'))
cf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cf)
def query(sql, params=()):
    return cf.api(f'/d1/database/{cf.DB}/query', 'POST', {'sql': sql, 'params': list(params)})[0]
before = []
changes = []
for p in plan:
    project = query('SELECT * FROM projects WHERE id=? AND slug=?', [p['id'], p['slug']])['results']
    assert len(project) == 1 and project[0]['organization_id'] == 'org_toys_agency'
    current = query("SELECT id,project_id,external_account_id,status,config_json FROM integrations WHERE project_id=? AND provider='meta_ads'", [p['id']])['results']
    assert len(current) <= 1
    if current:
        assert current[0]['external_account_id'] == p['metaAccount']
    config = json.loads(current[0]['config_json']) if current else {}
    config.update({'source': 'meta_graph_api', 'onboardingImport': True, 'verifyAccountMetadata': True,
                   'resultActionTypes': ['lead'], 'conversionMappingRevision': 'meta-lead-v1',
                   'insightChunkDays': 7, 'reconcileAccountTotals': True})
    if p['currency']:
        config['expectedCurrency'] = p['currency']
    else:
        config['allowCurrencyDiscovery'] = True
    integration_id = current[0]['id'] if current else 'int_' + p['key'] + '_meta'
    before.append({'project': project[0], 'integrations': current})
    changes.append((p, current, integration_id, json.dumps(config, separators=(',', ':'))))
backup = root / 'enrollment-before.json'
if not backup.exists():
    backup.write_text(json.dumps(before, ensure_ascii=False, indent=2))
    backup.chmod(0o600)
if '--apply' in sys.argv:
    for p, old, integration_id, config in changes:
        if old:
            r = query("UPDATE integrations SET status='active',config_json=? WHERE id=? AND project_id=? AND external_account_id=? AND config_json=? AND status=?", [config, integration_id, p['id'], p['metaAccount'], old[0]['config_json'], old[0]['status']])
        else:
            r = query("INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES(?,?,'meta_ads',?,'active',?)", [integration_id, p['id'], p['metaAccount'], config])
        assert r['meta']['changes'] == 1
print(json.dumps({'status': 'enrolled' if '--apply' in sys.argv else 'preflight_passed', 'projects': [p['slug'] for p in plan]}))
