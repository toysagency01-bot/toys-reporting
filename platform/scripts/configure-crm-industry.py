#!/usr/bin/env python3
"""Set a project's CRM niche using the shared templates. Preview unless --apply.

Usage: python scripts/configure-crm-industry.py PROJECT_SLUG real_estate --apply
Requires the niche-aware Worker and migration 0019. Does not rewrite lead rows.
"""
import importlib.util, json, pathlib, subprocess, sys, uuid

def main():
    if len(sys.argv) not in (3, 4) or (len(sys.argv) == 4 and sys.argv[3] != '--apply'):
        raise SystemExit(__doc__)
    slug, key = sys.argv[1:3]
    catalog = json.loads(subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import {PIPELINES} from './crm/pipelines.js';process.stdout.write(JSON.stringify(PIPELINES));"
    ], text=True))
    if key not in catalog:
        raise SystemExit('Unknown CRM template')
    template = catalog[key]
    spec = importlib.util.spec_from_file_location('cf', 'scripts/configure-client-access.py')
    cf = importlib.util.module_from_spec(spec); spec.loader.exec_module(cf)
    def query(sql, params):
        return cf.api(f'/d1/database/{cf.DB}/query', 'POST', {'sql': sql, 'params': params})[0]
    rows = query('SELECT id,settings_json FROM projects WHERE slug=?', [slug])['results']
    if len(rows) != 1:
        raise SystemExit('Project not found')
    project = rows[0]
    counts = query('SELECT current_status AS status,COUNT(*) AS total FROM leads WHERE project_id=? AND deleted_at IS NULL GROUP BY current_status', [project['id']])['results']
    allowed = {s['label'] for s in template['stages']}
    aliases = template.get('aliases', {})
    if any(aliases.get(row['status'], row['status']) not in allowed for row in counts):
        raise SystemExit('Existing stages need an explicit mapping before this template can be applied')
    settings = json.loads(project['settings_json'])
    settings.update(industry=key, crmTemplate=key, leadStatuses=[s['label'] for s in template['stages']])
    changed = False
    if '--apply' in sys.argv and settings != json.loads(project['settings_json']):
        directory = pathlib.Path('/workspace/toys-crm-config-private')
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        backup = directory / (uuid.uuid4().hex + '.json')
        backup.write_text(json.dumps({'slug': slug, **project})); backup.chmod(0o600)
        result = query("UPDATE projects SET settings_json=?,updated_at=datetime('now') WHERE id=? AND settings_json=?", [json.dumps(settings, ensure_ascii=False), project['id'], project['settings_json']])
        if result.get('meta', {}).get('changes') != 1:
            raise SystemExit('Project settings changed concurrently; review and retry')
        changed = True
    print(json.dumps({'project': slug, 'template': key, 'stages': len(allowed), 'activeLeads': sum(r['total'] for r in counts), 'applied': '--apply' in sys.argv, 'settingsChanged': changed, 'leadRowsRewritten': 0}))

if __name__ == '__main__':
    main()
