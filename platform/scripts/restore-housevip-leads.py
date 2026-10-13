#!/usr/bin/env python3
"""Restore private HOUSEVIP lead history, preserving feedback and avoiding CAPI replays.

Usage: python scripts/restore-housevip-leads.py PRIVATE_CAPTURE [--apply]
Raw captures and readback evidence must remain outside Git. No source writes.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

PROJECT = 'prj_housevip_cxp7'
BOOK = '1lEJk5DZl66DJui8p_U3hbEvMweEwGpA9bVIYeWq8Kms'


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def prepare(capture):
    data = capture['data']
    assert data['spreadsheetId'] == BOOK
    assert data['properties']['timeZone'] == 'Europe/Moscow'
    values = {s['properties']['title']: [[c.get('formattedValue', '') for c in r.get('values', [])]
              for g in s.get('data', []) for r in g.get('rowData', [])] for s in data['sheets']}
    assert [s.strip() for s in values['ЛИДЫ(Meta)'][0]] == ['Дата', 'Имя', 'Телефон', 'Почта', 'Способ связи', 'Бюджет']
    assert values['LeadFeedback'][0] == ['lead_id', 'status', 'client_comment', 'updated_at', 'status_updated_at']
    feedback = {r[0]: (r + [''] * 5)[:5] for r in values['LeadFeedback'][1:] if any(r)}
    output = {}
    for source_row, raw in enumerate(values['ЛИДЫ(Meta)'][1:], 2):
        if not any(raw):
            continue
        assert len(raw) == 6
        external = digest('\x1f'.join(v.strip() for v in raw))[:24]
        saved = feedback.get(external)
        original_status = saved[1] if saved else 'Новый'
        # The two observed source statuses map to the agreed platform workflow.
        # Preserve the exact original status and feedback in provenance and history.
        assert original_status in ['Новый', 'Связались']
        status = {'Новый': 'Новый', 'Связались': 'В работе'}[original_status]
        created = datetime.strptime(raw[0], '%d.%m.%Y %H:%M').replace(tzinfo=ZoneInfo('Europe/Moscow')).astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
        changed = (saved[4] or saved[3]) if saved else created
        datetime.fromisoformat(changed.replace('Z', '+00:00'))
        meta = {'sourceWorkbook': BOOK, 'sourceSheet': 'ЛИДЫ(Meta)', 'sourceTimezone': 'Europe/Moscow',
                'sourceDate': raw[0], 'contactMethod': raw[4], 'budget': raw[5],
                'legacyFeedback': saved, 'legacyStatus': original_status, 'migration': 'housevip-private-leads-v1'}
        item = {'id': 'lead_housevip_' + external, 'project_id': PROJECT, 'source_provider': 'legacy_meta_sheet',
                       'external_lead_id': external, 'created_at': created, 'name': raw[1], 'phone': raw[2],
                       'email': raw[3], 'contact_method': raw[4], 'budget': raw[5], 'current_status': status,
                       'status_updated_at': changed, 'metadata_json': json.dumps(meta, ensure_ascii=False, separators=(',', ':'))}
        if external in output:
            assert output[external]['record'] == item, 'Conflicting source identity'
            output[external]['rows'].append(source_row)
        else:
            output[external] = {'record': item, 'rows': [source_row]}
    assert set(feedback).issubset(output)
    result = []
    for entry in output.values():
        item = entry['record']
        meta = json.loads(item['metadata_json'])
        meta['sourceRows'] = entry['rows']
        item['metadata_json'] = json.dumps(meta, ensure_ascii=False, separators=(',', ':'))
        result.append(item)
    return result


def main():
    capture_path = Path(sys.argv[1]).resolve()
    assert Path(__file__).resolve().parents[2] not in capture_path.parents
    rows = prepare(json.loads(capture_path.read_text()))
    spec = importlib.util.spec_from_file_location('cf', Path(__file__).with_name('configure-client-access.py'))
    cf = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cf)
    def query(sql, params=()):
        return cf.api(f'/d1/database/{cf.DB}/query', 'POST', {'sql': sql, 'params': list(params)})[0]['results']
    assert query('SELECT slug FROM projects WHERE id=?', [PROJECT])[0]['slug'] == 'housevip-cxp7'
    fields = list(rows[0])
    existing = query('SELECT ' + ','.join(fields) + ' FROM leads WHERE project_id=? AND source_provider=?', [PROJECT, 'legacy_meta_sheet'])
    expected = {r['id']: r for r in rows}
    assert all(r['id'] in expected and r == expected[r['id']] for r in existing), 'Existing records changed; preserve edits'
    if '--apply' not in sys.argv:
        print(json.dumps({'status': 'preflight_passed', 'leads': len(rows), 'existing': len(existing), 'feedback': sum(bool(json.loads(r['metadata_json'])['legacyFeedback']) for r in rows)}))
        return
    backup = capture_path.with_name('housevip-leads-before.json')
    if not backup.exists():
        backup.write_text(json.dumps(existing, ensure_ascii=False))
        backup.chmod(0o600)
    quote = lambda v: "'" + str(v).replace("'", "''") + "'"
    for start in range(0, len(rows), 15):
        sql = []
        for r in rows[start:start+15]:
            meta = json.loads(r['metadata_json'])
            note = (meta['legacyFeedback'][2] if meta['legacyFeedback'] else '')
            if meta['legacyStatus'] != r['current_status']:
                note = ('Статус до переноса: ' + meta['legacyStatus'] + '. ' + note).strip()
            sql.append('INSERT OR IGNORE INTO leads (' + ','.join(fields) + ') VALUES (' + ','.join(quote(r[k]) for k in fields) + ')')
            event = ['evt_restore_' + r['external_lead_id'], PROJECT, r['id'], r['current_status'], r['status_updated_at'], note]
            sql.append('INSERT OR IGNORE INTO lead_status_events(id,project_id,lead_id,to_status,changed_at,note) VALUES(' + ','.join(map(quote, event)) + ')')
        cf.query(';\n'.join(sql))
    actual = query('SELECT ' + ','.join(fields) + ' FROM leads WHERE project_id=? AND source_provider=?', [PROJECT, 'legacy_meta_sheet'])
    assert {r['id']: r for r in actual} == expected, 'Readback mismatch'
    event_count = query("SELECT count(*) n FROM lead_status_events WHERE project_id=? AND id LIKE 'evt_restore_%'", [PROJECT])[0]['n']
    assert event_count == len(rows)
    print(json.dumps({'status': 'restored_and_verified', 'leads': len(rows), 'events': event_count, 'capiEventsCreated': 0}))


if __name__ == '__main__':
    main()
