#!/usr/bin/env python3
"""Client access rollout: schema, entry, access, or verify. No emails are sent by this script.

Deploy the tested Worker before running `access`: verified email is identity only;
the Worker's D1 memberships continue to authorize every protected project request.
The existing exact-owner policy is preserved. Never add a bypass policy.
"""
import json, os, pathlib, sys, urllib.request, urllib.error
ACCOUNT='6e1e68500c0dc88e70dde2da4117c79d'
APP='f43edd20-b86c-4b16-aa1f-5462da9e7534'
DB='0539d3d9-844e-470e-af6e-ae256fe4c81f'
BASE=f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}'
POLICY='TOYS clients - verified email with D1 project scopes'
SESSION_ROUTES=['reports.toys-agency.com/mvp/api/v2/portal/session*','toys-agency-platform-staging.denys-shpodaris.workers.dev/api/v2/portal/session*']
def api(path,method='GET',body=None):
 req=urllib.request.Request(BASE+path,method=method,data=None if body is None else json.dumps(body).encode(),headers={'Authorization':'Bearer '+os.environ['CLOUDFLARE_API_TOKEN'],'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=45) as r: result=json.load(r)
 except urllib.error.HTTPError as e:
  if e.code==403 and method=='POST' and path=='/access/identity_providers':
   raise SystemExit('Cloudflare refused OTP provider creation (403). Add One-time PIN in Zero Trust > Integrations > Identity providers, or grant Access: Organizations, Identity Providers, and Groups Write to this API token. Then rerun access. No client policy was applied.')
  raise SystemExit(f'Cloudflare {method} {path} HTTP {e.code}: {e.read().decode()[:1000]}')
 if not result.get('success'):raise SystemExit(json.dumps(result.get('errors')))
 return result['result']
def query(sql):return api(f'/d1/database/{DB}/query','POST',{'sql':sql})
def app():return api(f'/access/apps/{APP}')
def policies():return api(f'/access/apps/{APP}/policies')
def verify():
 a=app();ps=policies();p=next(p for p in ps if p['name']==POLICY)
 assert a['aud']=='4f271119fff5b798c799d346bea33e405c32471ab479ff571fec23d3ac75867c'
 routes={d['uri'] for d in a['destinations'] if d['type']=='public'}
 assert set(SESSION_ROUTES)<=routes
 assert p['decision']=='allow' and p['include']==[{'everyone':{}}]
 assert len(p['require'])==1 and p['require'][0].get('login_method',{}).get('id') in a['allowed_idps']
 assert any(p['id']=='440053cc-14c6-4b3d-9bdb-1fcee48c7c85' and p['decision']=='allow' for p in ps)
 assert not any(p['decision']=='bypass' for p in ps)
 print(json.dumps({'app_id':APP,'audience_preserved':True,'session_routes':SESSION_ROUTES,'verified_email_policy':p['id'],'requires_otp':True,'owner_policy_preserved':True,'bypass_policies':0}))
if __name__=='__main__':
 action=sys.argv[1] if len(sys.argv)>1 else ''
 if action=='schema':
  columns={r['name'] for r in query("SELECT name FROM pragma_table_info('users')")[0]['results']}
  if 'access_version' not in columns:
   assert 'access_claim' not in columns
   result=query(pathlib.Path('migrations/0015_client_access.sql').read_text())
   assert all(r.get('success') for r in result)
  check=query("SELECT COUNT(*) AS columns_ready FROM pragma_table_info('users') WHERE name IN ('access_version','access_claim')")[0]['results'][0]
  assert check['columns_ready']==2
  query('SELECT COUNT(*) FROM portal_access_writes')
  print(json.dumps({'migration':'0015_client_access','ready':True}))
 elif action in ('entry','access'):
  a=app();ps=policies();backup=pathlib.Path('dist/client-access-backup.json')
  if not backup.exists():backup.write_text(json.dumps({'app':a,'policies':ps},indent=2))
  assert a['aud']=='4f271119fff5b798c799d346bea33e405c32471ab479ff571fec23d3ac75867c'
  otp=None
  if action=='access':
   providers=api('/access/identity_providers');otp=next((p for p in providers if p['type']=='onetimepin'),None)
   if not otp:otp=api('/access/identity_providers','POST',{'name':'TOYS - Email code','type':'onetimepin','config':{}})
  fields=['type','name','domain','destinations','app_launcher_visible','allowed_idps','tags','auto_redirect_to_identity','session_duration','enable_binding_cookie','http_only_cookie_attribute','options_preflight_bypass','eager_redirect_cookie_setting']
  body={k:a[k] for k in fields if k in a}
  if otp:body['allowed_idps']=list(dict.fromkeys([*a.get('allowed_idps',[]),otp['id']]))
  body['http_only_cookie_attribute']=True
  body['name']='TOYS — Вход в платформу'
  body['logo_url']='https://reports.toys-agency.com/mvp/api/ui/reference/assets/toys-black.svg'
  destinations=body['destinations'];uris={d.get('uri') for d in destinations}
  for uri in SESSION_ROUTES:
   if uri not in uris:destinations.append({'type':'public','uri':uri})
  api(f'/access/apps/{APP}','PUT',body)
  if action=='entry':
   current=policies();assert {p['id'] for p in current}=={p['id'] for p in ps}
   for old in ps:
    new=next(p for p in current if p['id']==old['id'])
    assert all(new.get(k)==old.get(k) for k in ['decision','include','exclude','require'])
   print(json.dumps({'entry_routes_added':SESSION_ROUTES,'existing_policies_unchanged':True}))
   sys.exit(0)
  p=next((p for p in ps if p['name']==POLICY),None)
  payload={'name':POLICY,'decision':'allow','precedence':2,'include':[{'everyone':{}}],'exclude':[],'require':[{'login_method':{'id':otp['id']}}]}
  api(f'/access/apps/{APP}/policies'+('/'+p['id'] if p else ''),'PUT' if p else 'POST',payload)
  verify()
 elif action=='verify':verify()
 else:raise SystemExit(__doc__)
