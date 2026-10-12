#!/usr/bin/env python3
"""Private, resumable Sheets history archive. Does not publish or replace live data.

prepare --root PRIVATE_DIR
apply|verify --root PRIVATE_DIR (--sqlite LOCAL_FILE | --cloudflare)

Input: sources/<workbook>.metadata.json and sources/<workbook>.<sheet_id>.json,
captured through Google Drive get_spreadsheet_cells, with fetchedAt and data.
Raw client data and generated bundles must stay outside the repository.
"""
import argparse
import base64
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sqlite3
import sys

BOOKS = {
    '1C050_vkmWg3FtrgVz5WIKJurfYNlA0vWGkTZQpVASkU': 'prj_housevip_cxp7',
    '1lEJk5DZl66DJui8p_U3hbEvMweEwGpA9bVIYeWq8Kms': 'prj_housevip_cxp7',
    '1eue_NxKtqVbm3UQtb2DuN0b9snFvOKs-YF_Bi3KzaJw': 'prj_profkit_instashop_r4vk',
    '1BuY4cmiVY5384NQUGNSgT6pqr8Z_aDm2VFSUxbiaHrs': 'prj_profkit_instashop_r4vk',
    '1cEx4TQ9P8hJuLmwoxMaryFEk-zduI_jBa4TlsBLU-hk': 'prj_karlovarska_sul_k4rm',
    '1lTO2Lkon14FBLPxNQ39L9xpku8HIFQjQBPu4p4e8JMc': 'prj_karlovarska_sul_k4rm',
}
SCHEMA = Path(__file__).resolve().parents[1] / 'migrations/0016_source_history.sql'
EXCLUDED_SHEETS = {
    ('1lEJk5DZl66DJui8p_U3hbEvMweEwGpA9bVIYeWq8Kms', 612493655): 'lead_contact_rows',
    ('1lEJk5DZl66DJui8p_U3hbEvMweEwGpA9bVIYeWq8Kms', 1273117779): 'lead_feedback',
}


def assert_business_scope(item, envelope):
    if (item['workbook_id'], item['sheet_id']) in EXCLUDED_SHEETS:
        raise ValueError('Lead/contact sheets are excluded from the history migration')
    text = canonical(envelope)
    if re.search(r'\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', text, re.I):
        raise ValueError('Email-like content requires separate review; upload stopped')
    if re.search(r'access[_ ]?token|client[_ ]?secret|api[_ ]?key|пароль|password|bearer ', text, re.I):
        raise ValueError('Credential marker requires separate review; upload stopped')
    for sheet in envelope['data']['sheets']:
        for grid in sheet.get('data', []):
            for row in grid.get('rowData', []):
                for cell in row.get('values', []):
                    value = cell.get('effectiveValue', {}).get('stringValue', '').strip()
                    if re.fullmatch(r'(?:phone|telephone|e-?mail|lead(?: id| name)?|customer (?:name|phone|email)|телефон|тел\.?|почта|имя лида|контакт лида)', value, re.I):
                        raise ValueError('Contact column requires separate review; upload stopped')
                    if value.startswith('+') and 9 <= sum(c.isdigit() for c in value) <= 15 and re.fullmatch(r'[+\d][\d\s().-]+\d', value):
                        raise ValueError('Phone-like content requires separate review; upload stopped')


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def read(path):
    return json.loads(path.read_text())


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with open(path, 'w', encoding='utf-8') as output:
        os.chmod(path, 0o600)
        output.write(canonical(value) + '\n')


def snapshot(book, project, metadata, capture):
    sheet = capture['properties']
    data = capture['data']
    if capture['spreadsheetId'] != book or data['spreadsheetId'] != book:
        raise ValueError('Workbook identity mismatch')
    if len(data['sheets']) != 1 or data['sheets'][0]['properties']['sheetId'] != sheet['sheetId']:
        raise ValueError('Sheet identity mismatch')
    grids = data['sheets'][0].get('data', [])
    rows = sum(len(grid.get('rowData', [])) for grid in grids)
    cells = [cell for grid in grids for row in grid.get('rowData', []) for cell in row.get('values', []) if cell]
    # Capture timestamp is provenance, not content identity. Include full workbook/tab
    # metadata and the complete returned CellData, including formulas and rich links.
    envelope = {'workbook': {'spreadsheetId': book, 'spreadsheetUrl': metadata['spreadsheetUrl'],
                             'properties': metadata['properties']}, 'sheet': sheet, 'data': data}
    serialized = canonical(envelope)
    source_hash = digest(serialized)
    compressed = base64.b64encode(gzip.compress(serialized.encode(), mtime=0)).decode()
    pages = []
    for offset in range(0, len(compressed), 60000):
        payload = canonical({'encoding': 'gzip+base64', 'part': compressed[offset:offset + 60000]})
        pages.append({'page_index': len(pages), 'payload_json': payload, 'payload_hash': digest(payload)})
    return {
        'id': 'hist_' + digest(canonical([project, book, sheet['sheetId'], source_hash])),
        'project_id': project, 'workbook_id': book, 'sheet_id': sheet['sheetId'],
        'sheet_title': sheet['title'], 'source_hash': source_hash,
        'metadata_json': canonical({'workbook': envelope['workbook'], 'sheet': sheet,
                                    'encoding': 'gzip+base64', 'version': 1}),
        'captured_at': capture['fetchedAt'], 'row_count': rows, 'cell_count': len(cells),
        'page_count': len(pages), 'pages': pages,
        'formula_count': sum('formulaValue' in cell.get('userEnteredValue', {}) for cell in cells),
        'hyperlink_count': sum(bool(cell.get('hyperlink')) for cell in cells),
    }


def validate_pages(item, pages):
    if len(pages) != item['page_count']:
        raise ValueError('Incomplete archive pages: ' + item['id'])
    parts = []
    for index, page in enumerate(pages):
        if page['page_index'] != index or digest(page['payload_json']) != page['payload_hash']:
            raise ValueError('Archive page integrity failure: ' + item['id'])
        payload = json.loads(page['payload_json'])
        if payload['encoding'] != 'gzip+base64':
            raise ValueError('Unknown archive encoding')
        parts.append(payload['part'])
    serialized = gzip.decompress(base64.b64decode(''.join(parts), validate=True)).decode()
    if digest(serialized) != item['source_hash']:
        raise ValueError('Archive content hash mismatch: ' + item['id'])
    envelope = json.loads(serialized)
    if (envelope['workbook']['spreadsheetId'], envelope['sheet']['sheetId'], envelope['sheet']['title']) != (
            item['workbook_id'], item['sheet_id'], item['sheet_title']):
        raise ValueError('Archive content identity mismatch')
    expected_id = 'hist_' + digest(canonical([item['project_id'], item['workbook_id'], item['sheet_id'], item['source_hash']]))
    if item['id'] != expected_id:
        raise ValueError('Archive snapshot identity mismatch')
    return envelope


def prepare(root):
    snapshots = []
    excluded = []
    for book, project in BOOKS.items():
        metadata = read(root / 'sources' / f'{book}.metadata.json')
        if metadata['spreadsheetId'] != book:
            raise ValueError('Metadata identity mismatch')
        for tab in metadata['sheets']:
            sheet = tab['properties']
            capture = read(root / 'sources' / f"{book}.{sheet['sheetId']}.json")
            if capture['properties'] != sheet:
                raise ValueError('Sheet changed during capture; recapture required')
            exclusion = EXCLUDED_SHEETS.get((book, sheet['sheetId']))
            if exclusion:
                excluded.append({'workbook_id': book, 'sheet_id': sheet['sheetId'], 'reason': exclusion})
                continue
            item = snapshot(book, project, metadata, capture)
            assert_business_scope(item, validate_pages(item, item['pages']))
            snapshots.append(item)
    bundle = {'version': 1, 'scope': 'business_source_history_only', 'snapshots': snapshots}
    save(root / 'prepared' / 'archive.json', bundle)
    summary = {'workbooks': len(BOOKS), 'sheets': len(snapshots),
               'source_sheets_captured': len(snapshots) + len(excluded), 'excluded_from_upload': excluded,
               'rows': sum(s['row_count'] for s in snapshots),
               'cells': sum(s['cell_count'] for s in snapshots),
               'formulas': sum(s['formula_count'] for s in snapshots),
               'hyperlinks': sum(s['hyperlink_count'] for s in snapshots),
               'pages': sum(s['page_count'] for s in snapshots),
               'captured_from': min(s['captured_at'] for s in snapshots),
               'captured_to': max(s['captured_at'] for s in snapshots),
               'bundle_hash': digest(canonical(bundle)),
               'remote_applied': False}
    save(root / 'prepared' / 'summary.json', summary)
    return summary


class SQLite:
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        os.chmod(path, 0o600)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA foreign_keys=ON')

    def schema(self):
        self.db.executescript(SCHEMA.read_text())

    def query(self, sql, params=()):
        cursor = self.db.execute(sql, params)
        result = [dict(row) for row in cursor.fetchall()]
        self.db.commit()
        return result


class Cloudflare:
    def __init__(self):
        spec = importlib.util.spec_from_file_location('cf', Path(__file__).with_name('configure-client-access.py'))
        self.cf = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.cf)

    def schema(self):
        self.cf.query(SCHEMA.read_text())

    def query(self, sql, params=()):
        result = self.cf.api(f'/d1/database/{self.cf.DB}/query', 'POST', {'sql': sql, 'params': list(params)})
        if len(result) != 1 or not result[0].get('success'):
            raise ValueError('D1 query failed')
        return result[0]['results']


FIELDS = ['id', 'project_id', 'workbook_id', 'sheet_id', 'sheet_title', 'source_hash',
          'metadata_json', 'captured_at', 'row_count', 'cell_count', 'page_count']


def check_header(item, stored):
    # The first timestamp is retained when the same content is captured again.
    if any(stored[field] != item[field] for field in FIELDS if field != 'captured_at'):
        raise ValueError('Conflicting archive header: ' + item['id'])


def transfer(db, bundle, apply=False):
    if bundle.get('version') != 1 or bundle.get('scope') != 'business_source_history_only':
        raise ValueError('Unsupported archive bundle')
    seen = set()
    for item in bundle['snapshots']:
        if BOOKS.get(item['workbook_id']) != item['project_id']:
            raise ValueError('Archive project scope mismatch')
        key = (item['workbook_id'], item['sheet_id'])
        if key in seen:
            raise ValueError('Duplicate sheet in archive bundle')
        seen.add(key)
        assert_business_scope(item, validate_pages(item, item['pages']))
    if apply:
        db.schema()
    counts = {'verified': 0, 'inserted_snapshots': 0, 'inserted_pages': 0}
    for item in bundle['snapshots']:
        stored = db.query('SELECT * FROM source_history_snapshots WHERE id=?', [item['id']])
        if not stored:
            if not apply:
                raise ValueError('Snapshot absent: ' + item['id'])
            db.query('INSERT OR IGNORE INTO source_history_snapshots (' + ','.join(FIELDS) +
                     ') VALUES (' + ','.join('?' for _ in FIELDS) + ')', [item[field] for field in FIELDS])
            stored = db.query('SELECT * FROM source_history_snapshots WHERE id=?', [item['id']])
            counts['inserted_snapshots'] += 1
        check_header(item, stored[0])
        existing = db.query('SELECT page_index,payload_json,payload_hash FROM source_history_pages '
                            'WHERE snapshot_id=? ORDER BY page_index', [item['id']])
        by_index = {page['page_index']: page for page in existing}
        for page in item['pages']:
            if page['page_index'] in by_index:
                if by_index[page['page_index']] != page:
                    raise ValueError('Conflicting archive page: ' + item['id'])
                continue
            if not apply or stored[0]['complete']:
                raise ValueError('Missing archive page: ' + item['id'])
            db.query('INSERT OR IGNORE INTO source_history_pages '
                     '(snapshot_id,page_index,payload_json,payload_hash) VALUES (?,?,?,?)',
                     [item['id'], page['page_index'], page['payload_json'], page['payload_hash']])
            counts['inserted_pages'] += 1
        # Read after all writes. A crash/quota failure leaves complete=0 and resumes.
        pages = db.query('SELECT page_index,payload_json,payload_hash FROM source_history_pages '
                         'WHERE snapshot_id=? ORDER BY page_index', [item['id']]) if apply and not stored[0]['complete'] else existing
        validate_pages(item, pages)
        if not stored[0]['complete']:
            if not apply:
                raise ValueError('Snapshot not sealed: ' + item['id'])
            db.query('UPDATE source_history_snapshots SET complete=1 WHERE id=? AND complete=0', [item['id']])
        counts['verified'] += 1
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'apply', 'verify'])
    parser.add_argument('--root', required=True, type=Path)
    target = parser.add_mutually_exclusive_group()
    target.add_argument('--sqlite', type=Path)
    target.add_argument('--cloudflare', action='store_true')
    args = parser.parse_args()
    root = args.root.resolve()
    repo = Path(__file__).resolve().parents[2]
    if root == repo or repo in root.parents:
        parser.error('Private captures and generated bundles must be outside the repository')
    os.umask(0o077)
    if args.action == 'prepare':
        result = prepare(root)
    else:
        if not args.sqlite and not args.cloudflare:
            parser.error('Select --sqlite or --cloudflare')
        bundle = read(root / 'prepared' / 'archive.json')
        db = Cloudflare() if args.cloudflare else SQLite(args.sqlite)
        result = transfer(db, bundle, apply=args.action == 'apply')
        result['target'] = 'cloudflare' if args.cloudflare else 'local'
        result['bundle_hash'] = digest(canonical(bundle))
        save(root / 'prepared' / f'{result["target"]}-{args.action}.json', result)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
