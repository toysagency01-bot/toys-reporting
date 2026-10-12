#!/usr/bin/env python3
"""Mirror existing protected Access paths onto clean URLs; do not alter policies.

Usage: python scripts/configure-clean-routes.py apply|verify
Run before publishing the Pages routing change. No identity providers are created.
"""
import importlib.util,json,pathlib,sys
spec=importlib.util.spec_from_file_location('client_access',pathlib.Path(__file__).with_name('configure-client-access.py'))
cf=importlib.util.module_from_spec(spec);spec.loader.exec_module(cf)
def clean_destinations(app):
 routes={d['uri'] for d in app['destinations'] if d['type']=='public'}
 clean={uri.replace('reports.toys-agency.com/mvp/','reports.toys-agency.com/',1) for uri in routes if uri.startswith('reports.toys-agency.com/mvp/')}
 return clean|{'reports.toys-agency.com/master','reports.toys-agency.com/master/*','reports.toys-agency.com/api/v2/portal/session*'}
def verify(before=None):
 app=cf.app();routes={d['uri'] for d in app['destinations'] if d['type']=='public'}
 assert clean_destinations(app)<=routes
 assert app['aud']=='4f271119fff5b798c799d346bea33e405c32471ab479ff571fec23d3ac75867c'
 policies=cf.policies()
 if before is not None:
  assert {p['id'] for p in policies}=={p['id'] for p in before}
  for old in before:
   new=next(p for p in policies if p['id']==old['id'])
   assert all(new.get(k)==old.get(k) for k in ['decision','include','exclude','require'])
 print(json.dumps({'clean_paths_protected':sorted(clean_destinations(app)),'audience_preserved':True,'policy_count':len(policies),'policies_unchanged':True if before is not None else None}))
if __name__=='__main__':
 action=sys.argv[1] if len(sys.argv)>1 else ''
 if action=='apply':
  app=cf.app();policies=cf.policies();backup=pathlib.Path('dist/clean-routes-access-before.json')
  if not backup.exists():backup.write_text(json.dumps({'app':app,'policies':policies},indent=2))
  fields=['type','name','domain','destinations','app_launcher_visible','allowed_idps','tags','auto_redirect_to_identity','session_duration','enable_binding_cookie','http_only_cookie_attribute','options_preflight_bypass','eager_redirect_cookie_setting']
  body={k:app[k] for k in fields if k in app};routes={d.get('uri') for d in body['destinations']}
  for uri in sorted(clean_destinations(app)-routes):body['destinations'].append({'type':'public','uri':uri})
  body['logo_url']='https://reports.toys-agency.com/api/ui/reference/assets/toys-black.svg'
  cf.api(f'/access/apps/{cf.APP}','PUT',body);verify(policies)
 elif action=='verify':
  backup=pathlib.Path('dist/clean-routes-access-before.json')
  verify(json.loads(backup.read_text())['policies'] if backup.exists() else None)
 else:raise SystemExit(__doc__)
