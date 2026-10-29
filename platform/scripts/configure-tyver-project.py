#!/usr/bin/env python3
"""One-time setup of TYVER only. No permanent provisioning, secrets or role changes.
prepare: create the private project and request a read-only Meta import through
existing scheduling, whose accountMetadata verification is mandatory before data.
confirm: adopt metadata only after the ordinary importer verified the account.
status: scoped, non-secret setup/import diagnostics.
"""
import json,pathlib,runpy,subprocess,sys,datetime
c=runpy.run_path(str(pathlib.Path(__file__).with_name('configure-client-access.py')))
PID='prj_managed_tyver_20261029'; ACCOUNT='762053572501853'; IID='managed-meta-'+PID+'-'+ACCOUNT

def query(sql,params=None):
 r=c['api']('/d1/database/'+c['DB']+'/query','POST',{'sql':sql,'params':params or []});assert all(x['success'] for x in r);return r[0]
def rows(sql,params=None):return query(sql,params)['results']
def status():
 return rows("SELECT p.slug,p.status,p.currency,p.timezone,i.status AS integrationStatus,json_extract(i.config_json,'$.accountMetadataCheckedAt') AS verifiedAt,s.state AS importState,s.last_success_at,s.last_error_code FROM projects p LEFT JOIN integrations i ON i.project_id=p.id AND i.id=? LEFT JOIN ads_import_status s ON s.integration_id=i.id WHERE p.id=?",[IID,PID])
action=sys.argv[1] if len(sys.argv)>1 else 'status';assert action in ('prepare','confirm','refresh','status')
if action=='prepare':
 assert not rows("SELECT id FROM projects WHERE lower(name)='tyver' AND id!=?",[PID]),'A different TYVER project exists; preserve it'
 assert not rows("SELECT id FROM integrations WHERE provider='meta_ads' AND external_account_id=? AND project_id!=? AND status='active'",[ACCOUNT,PID]),'Account already in use'
 existing=rows('SELECT id,slug FROM projects WHERE id=?',[PID]);assert not existing or existing[0]['slug']=='project-tyver','Identity mismatch'
 seed=json.loads(subprocess.check_output(['node','scripts/tyver-project-seed.mjs']))
 if not existing:
  for statement in seed['statements']:query(statement['sql'],statement['params'])
 connection=rows("SELECT state FROM project_setup_connections WHERE project_id=? AND provider='meta_ads'",[PID])
 if not connection:
  at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
  config={'source':'managed_meta','verifyAccountMetadata':True,'allowCurrencyDiscovery':True,'productFunnel':True,'resultActionTypes':['lead'],'insightChunkDays':1,'refreshRequestedAt':at}
  query("INSERT INTO project_setup_connections(project_id,provider,account_id,state,config_json) VALUES(?,'meta_ads',?,'pending','{}')",[PID,ACCOUNT])
  query("INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json,sync_from_date) VALUES(?,?,'meta_ads',?,'active',?,'2026-10-01')",[IID,PID,ACCOUNT,json.dumps(config)])
if action=='confirm':
 r=rows("SELECT config_json FROM integrations WHERE id=? AND project_id=? AND external_account_id=? AND status='active'",[IID,PID,ACCOUNT]);assert len(r)==1
 config=json.loads(r[0]['config_json']);assert config.get('accountMetadataCheckedAt'),'Account verification has not succeeded'
 query("UPDATE project_setup_connections SET state='connected',config_json=?,last_checked_at=? WHERE project_id=? AND provider='meta_ads' AND state='pending'",[json.dumps({'currency':config['expectedCurrency'],'timezone':config['accountTimezone']}),config['accountMetadataCheckedAt'],PID])
 # Version guard protects any setup edits made in the meantime.
 query("UPDATE projects SET timezone=?,currency=?,settings_json=json_set(settings_json,'$.browserProject.periodTimezone',?,'$.browserProject.contentRevision','tyver-verified-v1') WHERE id=? AND EXISTS(SELECT 1 FROM project_setup_state WHERE project_id=? AND version=1)",[config['accountTimezone'],config['expectedCurrency'],config['accountTimezone'],PID,PID])
 query("UPDATE project_setup_state SET setup_json=json_set(setup_json,'$.timezone',?,'$.currency',?),version=version+1 WHERE project_id=? AND version=1",[config['accountTimezone'],config['expectedCurrency'],PID])
if action=='refresh':
 r=rows("SELECT config_json FROM integrations WHERE id=? AND project_id=? AND external_account_id=? AND status='active'",[IID,PID,ACCOUNT]);assert len(r)==1
 config=json.loads(r[0]['config_json']);assert config.get('productFunnel') and config.get('accountMetadataCheckedAt'),'Verified product account required'
 at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
 query("UPDATE integrations SET config_json=json_set(config_json,'$.refreshRequestedAt',?,'$.productEventRevision','tyver-Trial-v1') WHERE id=? AND project_id=? AND external_account_id=? AND status='active'",[at,IID,PID,ACCOUNT])
print(json.dumps(status()))
