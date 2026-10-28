#!/usr/bin/env python3
"""Additive managed-project schema. Creates no projects, grants or credentials."""
import json,pathlib,runpy,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
c=runpy.run_path(str(ROOT/'scripts/configure-client-access.py'))
TABLES={'project_setup_state','project_setup_writes','project_setup_connections','project_setup_crm_cards','project_setup_crm_sync','project_setup_ad_rows'}
def query(sql):return c['api']('/d1/database/'+c['DB']+'/query','POST',{'sql':sql})[0]['results']
action=sys.argv[1] if len(sys.argv)>1 else 'status'
existing={r['name'] for r in query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'project_setup_%'")}
if action=='schema':
 if existing and existing!=TABLES:raise SystemExit('Partial project-management schema detected; preserve existing data and reconcile before continuing.')
 if not existing:
  result=c['api']('/d1/database/'+c['DB']+'/query','POST',{'sql':(ROOT/'migrations/0039_project_management.sql').read_text()})
  assert all(r['success'] for r in result)
 existing={r['name'] for r in query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'project_setup_%'")}
assert existing==TABLES,'Project-management schema is not installed'
assert {r['name'] for r in query("SELECT name FROM pragma_table_info('project_setup_state')")} >= {'project_id','setup_json','version','created_by','write_token'}
release=runpy.run_path(str(ROOT/'scripts/release-unified.py'));bindings={b['name'] for b in release['api']('/settings')['bindings']}
print(json.dumps({'schemaReady':True,'managedProjects':query('SELECT COUNT(*) n FROM project_setup_state')[0]['n'],'encryptedConnectionStorageReady':'CRM_ENCRYPTION_KEY' in bindings,'agencyMetaConfigured':'META_ADS_ACCESS_TOKEN' in bindings}))
