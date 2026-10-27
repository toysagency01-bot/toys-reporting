#!/usr/bin/env python3
"""Prepare the approved Google Forms source. Never imports existing brief rows.

Usage: python scripts/configure-brief-intake.py apply|status
The token stays only in the encrypted Worker binding and the private admin setup UI.
"""
import datetime
import json
import pathlib
import runpy
import secrets
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CF = runpy.run_path(str(ROOT / 'scripts/configure-client-access.py'))
WORKER = runpy.run_path(str(ROOT / 'scripts/release-unified.py'))
SOURCE = ('briefs-ds', '1SvEG8VNqmGhhND9UGyKXBbKczjTA__nG8Lla7EPtVyA',
          269775685, 'Ответы на форму (1)', 'Asia/Dubai',
          '1OrCr9Zjqz3we4cwxR6gS0Jh5lXOks_W_')


def query(sql, params=None):
    results = CF['api']('/d1/database/' + CF['DB'] + '/query', 'POST',
                        {'sql': sql, 'params': params or []})
    if not all(r.get('success') for r in results):
        raise SystemExit('D1 operation failed')
    return results


def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''
    if action not in ('apply', 'status'):
        raise SystemExit(__doc__)
    if action == 'apply':
        query((ROOT / 'migrations/0037_project_onboarding.sql').read_text())
        existing = query('SELECT * FROM brief_sources WHERE id=?', [SOURCE[0]])[0]['results']
        if existing:
            row = existing[0]
            if tuple(row[k] for k in ['id', 'spreadsheet_id', 'sheet_id', 'sheet_name', 'timezone']) != SOURCE[:5]:
                raise SystemExit('Existing brief source differs; refusing overwrite')
        else:
            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            query('INSERT INTO brief_sources(id,spreadsheet_id,sheet_id,sheet_name,timezone,drive_parent_id,enabled,accept_from) VALUES(?,?,?,?,?,?,1,?)', [*SOURCE, now])
        bindings = WORKER['api']('/settings')['bindings']
        if not any(b['name'] == 'BRIEF_INTAKE_TOKEN' and b['type'] == 'secret_text' for b in bindings):
            WORKER['api']('/secrets', 'PUT', {'name': 'BRIEF_INTAKE_TOKEN', 'type': 'secret_text', 'text': secrets.token_urlsafe(48)})
    row = query('SELECT id,spreadsheet_id,sheet_id,enabled,accept_from,drive_parent_id,last_checked_at,last_received_at FROM brief_sources WHERE id=?', [SOURCE[0]])[0]['results']
    print(json.dumps({'source': row, 'projectsCreated': query('SELECT COUNT(*) n FROM project_onboarding')[0]['results'][0]['n'],
                      'activeWorker': WORKER['current'](), 'triggerInstallation': 'requires_google_owner_setup'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
