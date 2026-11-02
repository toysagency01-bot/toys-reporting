#!/usr/bin/env python3
"""User-authorized QualifiedLead CAPI setup, AM Klinika only.
No historical milestone changes, secret values or synthetic conversions.
"""
import datetime,json,pathlib,runpy,sys
c=runpy.run_path(str(pathlib.Path(__file__).with_name('configure-client-access.py')));release=runpy.run_path(str(pathlib.Path(__file__).with_name('release-unified.py')))
P='prj_amklinika_k8m2';ACCOUNT='1830858661278666';PAGE='1069830429555541'
def q(sql,params=None):
 r=c['api']('/d1/database/'+c['DB']+'/query','POST',{'sql':sql,'params':params or []});assert all(x['success'] for x in r);return r[0]['results']
action=sys.argv[1] if len(sys.argv)>1 else 'status'
if action=='prepare':
 assert len(sys.argv)==3 and release['current']()==[{'version_id':sys.argv[2],'percentage':100}],'Active release differs'
 assert q("SELECT external_account_id FROM integrations WHERE project_id=? AND provider='meta_ads' AND status='active'",[P])==[{'external_account_id':ACCOUNT}]
 assert q('SELECT state FROM crm_meta_sources WHERE project_id=? AND page_id=? AND account_id=?',[P,PAGE,ACCOUNT])==[{'state':'ready'}],'Meta intake not ready'
 cfg=q('SELECT capi_enabled,dataset_id,capi_setup_state,capi_from FROM crm_projects WHERE project_id=?',[P]);assert len(cfg)==1 and cfg[0]['capi_enabled']==0 and cfg[0]['dataset_id'] is None and cfg[0]['capi_setup_state'] is None,'Preserve existing CAPI configuration'
 at=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
 result=q("UPDATE crm_projects SET capi_kinds='qualified',qualified_event='QualifiedLead',capi_from=?,capi_setup_state='pending',capi_setup_error=NULL,updated_at=? WHERE project_id=? AND capi_enabled=0 AND dataset_id IS NULL AND capi_setup_state IS NULL RETURNING project_id",[at,at,P]);assert len(result)==1
 q("UPDATE crm_meta_sources SET next_attempt_at=?,updated_at=? WHERE project_id=? AND page_id=? AND state='ready' AND (lease_until IS NULL OR lease_until<?)",[at,at,P,PAGE,at])
 q("INSERT INTO audit_log(project_id,action,entity_type,entity_id,after_json) VALUES(?,'crm.capi.setup.requested','project',?,?)",[P,P,json.dumps({'actor':'user_request','kinds':['qualified'],'historicalReplay':False,'from':at})])
elif action!='status':raise SystemExit('prepare EXPECTED_VERSION | status')
print(json.dumps({'config':q('SELECT dataset_id,capi_enabled,capi_kinds,qualified_event,capi_from,capi_setup_state,capi_setup_error,capi_token_cipher IS NOT NULL AS tokenConfigured FROM crm_projects WHERE project_id=?',[P]),'datasets':q('SELECT account_id,pixels_json FROM crm_agent_accounts WHERE account_id=?',[ACCOUNT]),'deliveries':q("SELECT state,last_error,COUNT(*) count FROM crm_delivery WHERE project_id=? AND kind='capi' GROUP BY state,last_error",[P])}))
