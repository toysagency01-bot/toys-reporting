#!/usr/bin/env python3
"""Persist the approved VISA KeyCRM settings without activating an unverified import.

Usage: python scripts/configure-visa-keycrm.py status|apply
No KeyCRM request is made and no credential value is read or printed.
"""
import json
import pathlib
import runpy
import sys

ROOT = pathlib.Path(__file__).resolve().parent
CF = runpy.run_path(str(ROOT / 'configure-client-access.py'))
WORKER = runpy.run_path(str(ROOT / 'release-unified.py'))
PROJECT_ID = 'prj_visa_agency_qa3b'
SLUG = 'visa-agency-qa3b'
CONFIG = {
    'provider': 'keycrm',
    'apiBase': 'https://openapi.keycrm.app/v1',
    'secretName': 'KEYCRM_VISA_API_TOKEN',
    'qualifiedLabels': ['Прогріти', 'Жовтий', 'Зелені'],
    'dateBasis': 'lead_received_at',
    'deduplication': 'keycrm_card_id',
    'state': 'pending_verification',
    'syncEnabled': False,
}


def query(sql, params=None):
    result = CF['api']('/d1/database/' + CF['DB'] + '/query', 'POST',
                       {'sql': sql, 'params': params or []})
    if len(result) != 1 or not result[0].get('success'):
        raise SystemExit('D1 query failed')
    return result[0]


def project():
    rows = query('SELECT settings_json FROM projects WHERE id=? AND slug=?',
                 [PROJECT_ID, SLUG])['results']
    if len(rows) != 1:
        raise SystemExit('VISA project identity mismatch')
    return rows[0]['settings_json']


def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''
    if action not in ('status', 'apply'):
        raise SystemExit(__doc__)
    bindings = WORKER['api']('/settings')['bindings']
    secret_ready = any(b['name'] == CONFIG['secretName'] and b['type'] == 'secret_text'
                       for b in bindings)
    original = project()
    settings = json.loads(original or '{}')
    old = settings.get('crmKeyCRM')
    if action == 'apply':
        if not secret_ready:
            raise SystemExit('Expected encrypted Worker secret is missing')
        if old is not None and old != CONFIG:
            raise SystemExit('Existing KeyCRM settings differ; refusing to overwrite them')
        if old is None:
            # Compare-and-swap protects concurrent edits to unrelated settings.
            result = query("UPDATE projects SET settings_json=json_set(COALESCE(settings_json,'{}'),'$.crmKeyCRM',json(?)) WHERE id=? AND slug=? AND settings_json IS ?",
                           [json.dumps(CONFIG, ensure_ascii=False), PROJECT_ID, SLUG, original])
            if result.get('meta', {}).get('changes') != 1:
                raise SystemExit('Project settings changed concurrently; rerun after review')
        saved = json.loads(project())
        expected = {**settings, 'crmKeyCRM': CONFIG}
        if saved != expected:
            raise SystemExit('Project settings verification failed')
        settings = saved
    print(json.dumps({'project': SLUG, 'secretPresent': secret_ready,
                      'keycrm': settings.get('crmKeyCRM'),
                      'importActivated': bool(settings.get('crmKeyCRM',{}).get('syncEnabled'))}, ensure_ascii=False))


if __name__ == '__main__':
    main()
