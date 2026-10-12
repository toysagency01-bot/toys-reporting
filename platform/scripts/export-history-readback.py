#!/usr/bin/env python3
"""Read-only, project-scoped D1 backup for history reconciliation (outside Git)."""
import argparse
from datetime import datetime, timezone
import importlib.util
import os
from pathlib import Path

spec = importlib.util.spec_from_file_location('history', Path(__file__).with_name('source-history.py'))
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)


def export(root, directory):
    db = h.Cloudflare()
    project_ids = sorted(set(h.BOOKS.values()))
    scope = ','.join('?' for _ in project_ids)
    started = datetime.now(timezone.utc).isoformat()
    pointers = db.query(f'SELECT * FROM project_data_release_pointers WHERE project_id IN ({scope}) ORDER BY project_id', project_ids)
    if len(pointers) != 3:
        raise ValueError('Expected three active release pointers')
    release_ids = [p['release_id'] for p in pointers]
    releases = db.query('SELECT * FROM project_data_releases WHERE id IN (?,?,?) ORDER BY id', release_ids)
    if len(releases) != 3:
        raise ValueError('Expected three active releases')
    import json
    generation_ids = []
    for release in releases:
        manifest = json.loads(release['manifest_json'])
        generation_ids.extend(s['generationId'] for s in [*manifest.get('datasets', []), *manifest.get('auxiliaryStreams', [])])
    generation_ids = sorted(set(generation_ids))
    output = root / directory
    output.mkdir(mode=0o700, parents=True, exist_ok=True)
    h.save(output / 'project_data_release_pointers.json', pointers)
    h.save(output / 'project_data_releases.json', releases)
    counts = {}
    for table in ['source_streams', 'project_tabs', 'weekly_reports', 'content_items', 'content_revisions', 'content_blocks']:
        rows = db.query(f'SELECT * FROM {table} WHERE project_id IN ({scope}) ORDER BY id', project_ids)
        h.save(output / f'{table}.json', rows)
        counts[table] = len(rows)
    gen_scope = ','.join('?' for _ in generation_ids)
    for table, columns, from_sql, order in [
            ('fact_observations', 'o.*', 'fact_observations o', 'o.id'),
            ('fact_values', 'v.*', 'fact_values v JOIN fact_observations o ON o.id=v.observation_id',
             'o.id,v.metric_code,v.metric_version,v.value_basis')]:
        rows = []
        while True:
            batch = db.query(f'SELECT {columns} FROM {from_sql} WHERE o.project_id IN ({scope}) '
                             f'AND o.generation_id IN ({gen_scope}) ORDER BY {order} LIMIT 1000 OFFSET ?',
                             [*project_ids, *generation_ids, len(rows)])
            rows.extend(batch)
            if len(batch) < 1000:
                break
        h.save(output / f'{table}.json', rows)
        counts[table] = len(rows)
    after = db.query(f'SELECT * FROM project_data_release_pointers WHERE project_id IN ({scope}) ORDER BY project_id', project_ids)
    if after != pointers:
        raise ValueError('Active releases changed during readback; rerun before reconciling')
    result = {'started_at': started, 'finished_at': datetime.now(timezone.utc).isoformat(),
              'release_pointers_stable': True, 'counts': counts}
    h.save(output / 'readback.json', result)
    print(h.canonical(result))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--directory', choices=['platform-before', 'platform-after'], default='platform-after')
    args = parser.parse_args()
    root = args.root.resolve()
    repo = Path(__file__).resolve().parents[2]
    if root == repo or repo in root.parents:
        parser.error('Readbacks must be outside the repository')
    if args.directory == 'platform-before' and (root / args.directory).exists():
        parser.error('Preserve the original before backup; use a new private root')
    os.umask(0o077)
    export(root, args.directory)
