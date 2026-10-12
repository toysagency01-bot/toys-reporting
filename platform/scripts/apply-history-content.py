#!/usr/bin/env python3
"""Apply a reviewed private history-content plan with per-row compare-and-swap.

Does not modify native content revisions, projects/settings, CRM or data releases.
Usage: apply-history-content.py ROOT (--sqlite FILE | --cloudflare) [--apply]
Without --apply performs read-only preflight. Requires verified source archive.
"""
import argparse
import importlib.util
import os
from pathlib import Path

spec = importlib.util.spec_from_file_location('history', Path(__file__).with_name('source-history.py'))
history = importlib.util.module_from_spec(spec)
spec.loader.exec_module(history)

FIELDS = {
    'project_tabs': ['id', 'project_id', 'channel', 'tab_key', 'source_title', 'label', 'mode', 'position',
                     'content_json', 'raw_content_json', 'source_hash', 'imported_at', 'updated_at'],
    'weekly_reports': ['id', 'project_id', 'period_start', 'period_end', 'summary', 'wins', 'issues', 'changes',
                       'next_steps', 'status', 'author_user_id', 'created_at', 'updated_at'],
}


def select(db, table, after):
    if table == 'project_tabs':
        rows = db.query('SELECT * FROM project_tabs WHERE project_id=? AND source_title=?',
                        [after['project_id'], after['source_title']])
    else:
        rows = db.query('SELECT * FROM weekly_reports WHERE project_id=? AND period_start=? AND period_end=?',
                        [after['project_id'], after['period_start'], after['period_end']])
    if len(rows) > 1:
        raise ValueError('Ambiguous existing content')
    return rows[0] if rows else None


def same(a, b, fields):
    return a is None and b is None or a is not None and b is not None and all(a.get(k) == b.get(k) for k in fields)


def validate(change):
    table, before, after = change['table'], change['before'], change['after']
    fields = FIELDS[table]
    if set(after) != set(fields) or after['project_id'] not in set(history.BOOKS.values()):
        raise ValueError('Unexpected content scope or fields')
    if before is not None:
        if not same(before, after, ['id', 'project_id']):
            raise ValueError('Content identity must not change')
        if table == 'weekly_reports':
            raise ValueError('Historical reports are immutable; insert missing periods only')
    return table, before, after, fields


def apply_plan(db, plan, apply=False):
    if plan.get('version') != 1 or plan.get('scope') != 'history_materials_and_period_reports':
        raise ValueError('Unsupported content plan')
    changes = [validate(change) for change in plan['changes']]
    pending = []
    # Check every row before starting. A later race is handled by the SQL predicate.
    for table, before, after, fields in changes:
        current = select(db, table, after)
        if same(current, after, fields):
            continue
        if not same(current, before, fields):
            raise ValueError('Content changed since readback; recapture and reconcile: ' + after['id'])
        pending.append((table, before, after, fields))
    if apply:
        for table, before, after, fields in pending:
            if before is None:
                db.query(f'INSERT OR IGNORE INTO {table} (' + ','.join(fields) + ') VALUES (' +
                         ','.join('?' for _ in fields) + ')', [after[k] for k in fields])
            else:
                db.query(f'UPDATE {table} SET ' + ','.join(k + '=?' for k in fields) +
                         ' WHERE ' + ' AND '.join(k + ' IS ?' for k in fields),
                         [after[k] for k in fields] + [before[k] for k in fields])
            if not same(select(db, table, after), after, fields):
                raise ValueError('Concurrent edit preserved; stop and reconcile: ' + after['id'])
    return {'planned': len(changes), 'already_current': len(changes) - len(pending),
            'pending': 0 if apply else len(pending), 'applied': len(pending) if apply else 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument('--sqlite', type=Path)
    target.add_argument('--cloudflare', action='store_true')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    os.umask(0o077)
    root = args.root.resolve()
    repo = Path(__file__).resolve().parents[2]
    if root == repo or repo in root.parents:
        parser.error('Private migration files must be outside the repository')
    db = history.Cloudflare() if args.cloudflare else history.SQLite(args.sqlite)
    history.transfer(db, history.read(root / 'prepared/archive.json'))
    result = apply_plan(db, history.read(root / 'prepared/content-changes.json'), apply=args.apply)
    result['target'] = 'cloudflare' if args.cloudflare else 'local'
    history.save(root / 'prepared' / f'{result["target"]}-content-{ "apply" if args.apply else "preflight"}.json', result)
    print(history.canonical(result))


if __name__ == '__main__':
    main()
