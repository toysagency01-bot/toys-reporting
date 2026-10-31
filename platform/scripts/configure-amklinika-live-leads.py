#!/usr/bin/env python3
"""Resume normal, verified Meta lead intake for the existing AM Klinika project.
No bypass of connectDirectMeta checks; no token, role or CAPI changes.
"""
import datetime,json,pathlib,runpy,sys
from zoneinfo import ZoneInfo
c=runpy.run_path(str(pathlib.Path(__file__).with_name('configure-client-access.py')))
P='prj_amklinika_k8m2';PAGE='1069830429555541';ACCOUNT='1830858661278666';APP='1115625427695947'
def q(sql,params=None):
 r=c['api']('/d1/database/'+c['DB']+'/query','POST',{'sql':sql,'params':params or []});assert all(x['success'] for x in r);return r[0]['results']
def status():
 print(json.dumps(q('SELECT page_id,state,last_error,connected_at,last_scan_at,next_attempt_at FROM crm_meta_sources WHERE project_id=?',[P])))
if len(sys.argv)>1 and sys.argv[1]=='apply':
 p=q("SELECT slug,settings_json FROM projects WHERE id=? AND status='active'",[P]);assert len(p)==1 and p[0]['slug']=='amklinika-k8m2'
 setup=json.loads(p[0]['settings_json']).get('directMetaSetup');assert setup=={'appId':APP,'pageId':PAGE},'Saved direct setup differs'
 assert q("SELECT external_account_id FROM integrations WHERE project_id=? AND provider='meta_ads' AND status='active'",[P])==[{'external_account_id':ACCOUNT}]
 page=q('SELECT project_id FROM crm_pages WHERE page_id=?',[PAGE]);assert not page or page[0]['project_id'] in (None,P),'Page belongs to another project'
 existing=q('SELECT project_id,account_id,app_id FROM crm_meta_sources WHERE page_id=?',[PAGE]);assert not existing or existing==[{'project_id':P,'account_id':ACCOUNT,'app_id':APP}]
 if not existing:
  now=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z');since=datetime.datetime(2026,10,31,tzinfo=ZoneInfo('Europe/Prague')).astimezone(datetime.timezone.utc).isoformat().replace('+00:00','Z')
  # The normal worker will resolve and verify the page token before accepting leads.
  q("INSERT INTO crm_pages(page_id,name,project_id,app_id,discovered_at,updated_at) VALUES(?,'AM Klinika',?,?,?,?) ON CONFLICT(page_id) DO NOTHING",[PAGE,P,APP,now,now])
  q('INSERT INTO crm_meta_sources(page_id,project_id,account_id,app_id,live_since,history_from,history_to,next_attempt_at,created_at,updated_at,history_enabled) VALUES(?,?,?,?,?,?,?,?,?,?,0)',[PAGE,P,ACCOUNT,APP,since,since,now,now,now,now])
  q("INSERT INTO audit_log(project_id,action,entity_type,entity_id,after_json) VALUES(?,'crm.meta.verification.requested','project',?,?)",[P,P,json.dumps({'reason':'user_requested_missing_lead_recovery','liveSince':since,'pageId':PAGE,'accountId':ACCOUNT})])
status()
