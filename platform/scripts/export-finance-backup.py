#!/usr/bin/env python3
"""Read an atomic finance-only D1 snapshot. Never writes to the source database.

Usage: python scripts/export-finance-backup.py /absolute/private/snapshot.json
Only aggregate receipt metadata is printed. The destination must be outside Git.
"""
import datetime
import hashlib
import json
import os
import pathlib
import runpy
import sys

TABLES = ['finance_state', 'finance_records', 'finance_writes',
          'finance_bank_state', 'finance_bank_rates', 'audit_log', 'project_invoices']


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    root = pathlib.Path(__file__).resolve().parents[2]
    target = pathlib.Path(sys.argv[1]).resolve()
    if not target.is_absolute() or target.is_relative_to(root):
        raise SystemExit('Backup output must be outside the repository')
    cf = runpy.run_path(str(pathlib.Path(__file__).with_name('configure-client-access.py')))

    def query(sql):
        result = cf['query'](sql)
        if len(result) != 1 or not result[0].get('success'):
            raise SystemExit('D1 snapshot query failed')
        return result[0]['results']

    # Schemas are read first; all table contents below are captured by one SELECT.
    parts = []
    for table in TABLES:
        columns = [r['name'] for r in query("SELECT name FROM pragma_table_info('%s')" % table)]
        if not columns:
            raise SystemExit('Required finance table is unavailable: ' + table)
        if table == 'finance_bank_state':
            columns = [c for c in columns if c != 'lease_until']
        fields = ','.join("'%s',\"%s\"" % (c, c) for c in columns)
        where = " WHERE action LIKE 'finance.%'" if table == 'audit_log' else ''
        if table == 'project_invoices':
            where = " WHERE id IN (SELECT json_extract(a.value,'$.invoiceId') FROM finance_records r,json_each(r.data_json,'$.allocations') a WHERE r.collection='transactions')"
        order = ','.join('"%s"' % c for c in columns)
        parts.append("'%s',json((SELECT json_group_array(json_object(%s)) FROM (SELECT * FROM %s%s ORDER BY %s)))" % (table, fields, table, where, order))
    raw = query('SELECT json_object(' + ','.join(parts) + ') AS snapshot')[0]['snapshot']
    tables = json.loads(raw)
    # Canonical JSON of table arrays is sufficient to reconstruct every exported
    # row, including tombstones, versions and source precision; no credentials.
    canonical = json.dumps(tables, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    digest = hashlib.sha256(canonical.encode()).hexdigest()
    snapshot = {'schema': 'toys-finance-backup/v1',
                'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'sha256': digest, 'tables': tables}
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as output:
        json.dump(snapshot, output, ensure_ascii=False)
    print(json.dumps({'file': str(target), 'sha256': digest,
                      'revision': tables['finance_state'][0]['revision'],
                      'counts': {k: len(v) for k, v in tables.items()}}))


if __name__ == '__main__':
    main()
