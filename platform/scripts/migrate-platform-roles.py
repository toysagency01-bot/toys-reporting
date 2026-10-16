#!/usr/bin/env python3
"""Add roles and seed existing owners without changing any project assignments.
Run before deploying the Worker. Rollback: restore the previous Worker version;
its authorization ignores the additive role table.
"""
import importlib.util,json,pathlib,hashlib

def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj);return obj
cf=module('cf','scripts/configure-client-access.py')
release=module('release','scripts/release-unified.py')
def query(sql,params=[]):return cf.api('/d1/database/'+cf.DB+'/query','POST',{'sql':sql,'params':params})[0]['results']
def fingerprint(rows):return hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()
if query("SELECT name FROM sqlite_master WHERE type='table' AND name='platform_user_roles'"):
 raise SystemExit('Role schema already exists. Inspect its rollout before applying again.')
before=query('SELECT project_id,user_id,role FROM project_memberships ORDER BY project_id,user_id')
usersBefore=query('SELECT id,email,status FROM users ORDER BY id')
settings=release.api('/settings')['bindings']
values={b['name']:b.get('text','') for b in settings if b['name'] in ['MVP_ALLOWED_EMAILS','MVP_MASTER_EMAILS']}
allowed={e.strip().lower() for e in values.get('MVP_ALLOWED_EMAILS','').split(',') if e.strip()}
owners={e.strip().lower() for e in values.get('MVP_MASTER_EMAILS','').split(',') if e.strip()}
assert owners and owners<=allowed,'Legacy owner configuration is inconsistent'
assert allowed==owners,'Non-owner legacy staff need an explicit assignment migration'
cf.api('/d1/database/'+cf.DB+'/query','POST',{'sql':pathlib.Path('migrations/0023_platform_roles.sql').read_text()})
for email in sorted(owners):
 query("INSERT INTO users(id,email,status) VALUES(?,?,'invited') ON CONFLICT(email) DO NOTHING",['role_owner_'+hashlib.sha256(email.encode()).hexdigest()[:24],email])
 query("INSERT INTO platform_user_roles(user_id,role) SELECT id,'admin' FROM users WHERE email=? ON CONFLICT(user_id) DO NOTHING",[email])
after=query('SELECT project_id,user_id,role FROM project_memberships ORDER BY project_id,user_id')
assert before==after,'Project assignments changed during migration'
usersAfter={u['id']:u for u in query('SELECT id,email,status FROM users ORDER BY id')}
assert all(usersAfter[u['id']]==u for u in usersBefore),'Existing user identities or status changed'
assert query("SELECT COUNT(*) AS n FROM platform_user_roles WHERE role='admin'")[0]['n']==len(owners)
result={'ok':True,'adminCount':len(owners),'existingUsersPreserved':len(usersBefore),'membershipsPreserved':len(before),'membershipHash':fingerprint(after),'roles':query('SELECT role,count(*) AS count FROM platform_user_roles GROUP BY role')}
pathlib.Path('dist/platform-roles-rollout.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
