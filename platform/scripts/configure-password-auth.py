#!/usr/bin/env python3
"""Add native auth schema, bootstrap an existing owner, or retire legacy Access paths.

Run cutover only after the PASSWORD_AUTH_ENABLED Worker has been deployed and tested.
Backups and one-time credentials stay outside the repository.
"""
import importlib.util, pathlib, json, secrets, hashlib, time, uuid, os, sys
spec=importlib.util.spec_from_file_location('cf',pathlib.Path(__file__).with_name('configure-client-access.py'))
cf=importlib.util.module_from_spec(spec);spec.loader.exec_module(cf)
private=pathlib.Path('/workspace/toys-auth-private');private.mkdir(mode=0o700,exist_ok=True)
def save(name,value):
 p=private/name;p.write_text(json.dumps(value,indent=2));p.chmod(0o600)
def query(sql,params=[]):return cf.api(f'/d1/database/{cf.DB}/query','POST',{'sql':sql,'params':params})
def settings():return {b['name']:b.get('text') for b in cf.api('/workers/scripts/toys-agency-platform-staging/settings')['bindings'] if b['type']=='plain_text'}
action=sys.argv[1]
if action=='schema':
 result=cf.query(pathlib.Path('migrations/0016_password_auth.sql').read_text());assert all(r.get('success') for r in result)
 print('Native password authentication schema ready.')
elif action=='bootstrap':
 email=sys.argv[2].lower();s=settings()
 assert email in s['MVP_MASTER_EMAILS'].split(',') and email in s['MVP_ALLOWED_EMAILS'].split(',')
 rows=query('SELECT id,status FROM users WHERE email=?',[email])[0]['results']
 if rows:
  user=rows[0];assert user['status']!='disabled'
 else:
  user={'id':str(uuid.uuid4())};query("INSERT INTO users(id,email,display_name,status) VALUES(?,?,?,'invited')",[user['id'],email,'TOYS Owner'])
 assert not query('SELECT user_id FROM portal_credentials WHERE user_id=?',[user['id']])[0]['results'],'Password already exists; do not reset it by bootstrapping.'
 token=secrets.token_hex(32);now=int(time.time());digest=hashlib.sha256(token.encode()).hexdigest()
 query('DELETE FROM portal_invitations WHERE user_id=?',[user['id']])
 query('INSERT INTO portal_invitations(token_hash,user_id,expires_at,created_by,created_at) VALUES(?,?,?,?,?)',[digest,user['id'],now+86400,'authorized-owner-bootstrap',now])
 save('owner-invitation.json',{'email':email,'activationUrl':'https://reports.toys-agency.com/api/v2/portal/activate#token='+token,'expiresAt':now+86400})
 print('Owner activation link saved privately; valid for 24 hours, single use.')
elif action=='cutover':
 assert settings().get('PASSWORD_AUTH_ENABLED')=='true','Deploy native auth first.'
 app=cf.app();policies=cf.policies();backup=private/'access-before-password.json'
 if not backup.exists():save(backup.name,{'app':app,'policies':policies})
 # Keep the old identity provider and policies for rollback, off every platform URL.
 legacy='toys-agency-platform-staging.denys-shpodaris.workers.dev/legacy-access-entry'
 fields=['type','name','app_launcher_visible','allowed_idps','tags','auto_redirect_to_identity','session_duration','enable_binding_cookie','http_only_cookie_attribute','options_preflight_bypass','eager_redirect_cookie_setting']
 body={k:app[k] for k in fields if k in app};body.update(name='TOYS legacy Access — retired',domain=legacy,destinations=[{'type':'public','uri':legacy}],app_launcher_visible=False)
 result=cf.api(f'/access/apps/{cf.APP}','PUT',body)
 assert result['destinations']==[{'type':'public','uri':legacy}]
 assert {p['id'] for p in cf.policies()}=={p['id'] for p in policies}
 print('Cloudflare login interception removed from platform routes; Worker password sessions enforce access.')
else:raise SystemExit(__doc__)
