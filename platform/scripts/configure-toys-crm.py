#!/usr/bin/env python3
"""Scoped TOYS CRM rollout. Never prints credentials or lead contacts.

Usage: python scripts/configure-toys-crm.py migrate
       python scripts/configure-toys-crm.py activate EXPECTED_WORKER_VERSION
       python scripts/configure-toys-crm.py resume-live EXPECTED_WORKER_VERSION
       python scripts/configure-toys-crm.py import-history FROM_DATE EXPECTED_WORKER_VERSION
       python scripts/configure-toys-crm.py status
"""
import datetime as dt
import importlib.util
import json
import pathlib
import sys
from zoneinfo import ZoneInfo

def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value)
    return value

cf=module('cf','scripts/configure-client-access.py')
release=module('release','scripts/release-unified.py')
PROJECT='prj_toys_agency_ctft'
PAGE='104044671298332'
ACCOUNT='503232073666825'
APP='1115625427695947'
DATASET='1036998279992732'

def query(sql,params=[]):
    return cf.api('/d1/database/'+cf.DB+'/query','POST',{'sql':sql,'params':params})[0]['results']

def status():
    for name,sql in {
        'crm':"SELECT access_mode,timezone,dataset_id,capi_enabled,capi_kinds,capi_from,capi_setup_state,capi_setup_error FROM crm_projects WHERE project_id=?",
        'source':"SELECT page_id,account_id,app_id,state,last_error,attempts,next_attempt_at,live_since,history_enabled,history_from,history_to,connected_at,forms_checked_at,last_scan_at FROM crm_meta_sources WHERE project_id=?",
        'forms':"SELECT COUNT(*) AS discovered,SUM(history_finished_at IS NOT NULL) AS scanned FROM crm_meta_forms WHERE page_id IN (SELECT page_id FROM crm_meta_sources WHERE project_id=?)",
        'deliveries':"SELECT kind,state,last_error,COUNT(*) AS count FROM crm_delivery WHERE project_id=? GROUP BY kind,state,last_error",
        'leads':"SELECT source_provider,COUNT(*) AS count,MIN(created_at) AS oldest,MAX(created_at) AS newest FROM leads WHERE project_id=? AND deleted_at IS NULL GROUP BY source_provider",
    }.items():
        print(json.dumps({name:query(sql,[PROJECT])},ensure_ascii=False))

action=sys.argv[1] if len(sys.argv)>1 else 'status'
if action=='migrate':
    cols={c['name'] for c in query("SELECT name FROM pragma_table_info('crm_projects')")}
    if 'access_mode' not in cols:
        result=cf.query(pathlib.Path('migrations/0024_crm_meta_sync.sql').read_text())
        assert all(r['success'] for r in result)
    cols={c['name'] for c in query("SELECT name FROM pragma_table_info('crm_projects')")}
    assert {'access_mode','capi_from','capi_kinds','capi_setup_state','capi_setup_error'}<=cols
    query('SELECT COUNT(*) FROM crm_meta_sources');query('SELECT COUNT(*) FROM crm_meta_forms')
    if not query("SELECT name FROM pragma_table_info('crm_meta_sources') WHERE name='history_enabled'"):
        result=cf.query(pathlib.Path('migrations/0025_crm_meta_history_opt_in.sql').read_text())
        assert all(r['success'] for r in result)
    print(json.dumps({'migration':'0025_crm_meta_history_opt_in','ready':True}))
elif action=='resume-live':
    assert len(sys.argv)==3,'Expected active Worker version is required'
    assert release.current()==[{'version_id':sys.argv[2],'percentage':100}],'Deployment changed'
    assert query('SELECT access_mode FROM crm_projects WHERE project_id=?',[PROJECT])==[{'access_mode':'admin'}]
    assert query('SELECT project_id,account_id,app_id FROM crm_meta_sources WHERE page_id=?',[PAGE])==[{'project_id':PROJECT,'account_id':ACCOUNT,'app_id':APP}]
    now=dt.datetime.now(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    result=query("UPDATE crm_meta_sources SET history_enabled=0,state='pending',attempts=0,last_error=NULL,next_attempt_at=?,updated_at=? WHERE page_id=? AND project_id=? AND (lease_until IS NULL OR lease_until<?) RETURNING page_id",[now,now,PAGE,PROJECT,now])
    assert result==[{'page_id':PAGE}],'Source is leased; retry after it completes'
    status()
elif action=='import-history':
    assert len(sys.argv)==4,'Start date and expected Worker version are required'
    assert release.current()==[{'version_id':sys.argv[3],'percentage':100}],'Deployment changed'
    start=dt.datetime.combine(dt.date.fromisoformat(sys.argv[2]),dt.time(),ZoneInfo('Asia/Tbilisi'))
    now=dt.datetime.now(dt.timezone.utc)
    assert start<now,'History start must be in the past'
    iso=lambda d:d.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    source=query('SELECT project_id,account_id,app_id,history_enabled,history_from FROM crm_meta_sources WHERE page_id=?',[PAGE])
    assert len(source)==1 and all(source[0][k]==v for k,v in {'project_id':PROJECT,'account_id':ACCOUNT,'app_id':APP}.items())
    assert query('SELECT access_mode FROM crm_projects WHERE project_id=?',[PROJECT])==[{'access_mode':'admin'}]
    if source[0]['history_enabled']==1 and source[0]['history_from']==iso(start):
        status();raise SystemExit(0)
    # Pause the scanner before resetting its window. Signed live webhooks continue.
    rows=query("UPDATE crm_meta_sources SET state='paused',history_enabled=0,updated_at=? WHERE page_id=? AND (lease_until IS NULL OR lease_until<?) RETURNING page_id",[iso(now),PAGE,iso(now)])
    assert rows==[{'page_id':PAGE}],'Scanner is leased; retry after the current scan'
    query('UPDATE crm_meta_forms SET cursor=NULL,scan_from=NULL,scan_to=NULL,history_finished_at=NULL,next_scan_at=? WHERE page_id=?',[iso(now),PAGE])
    query("UPDATE crm_meta_sources SET history_enabled=1,history_from=?,history_to=?,state='ready',last_error=NULL,attempts=0,next_attempt_at=?,updated_at=? WHERE page_id=?",[iso(start),iso(now),iso(now),iso(now),PAGE])
    status()
elif action=='activate':
    assert len(sys.argv)==3,'Expected active Worker version is required'
    assert release.current()==[{'version_id':sys.argv[2],'percentage':100}],'Deployment changed'
    rows=query("SELECT id FROM projects WHERE id=? AND slug='toys-agency-ctft' AND status='active'",[PROJECT]);assert len(rows)==1
    assert query("SELECT external_account_id FROM integrations WHERE project_id=? AND provider='meta_ads' AND status='active'",[PROJECT])==[{'external_account_id':ACCOUNT}]
    page=query('SELECT project_id FROM crm_pages WHERE page_id=?',[PAGE]);assert len(page)==1 and page[0]['project_id'] in (None,PROJECT)
    now=dt.datetime.now(dt.timezone.utc)
    iso=lambda d:d.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    # Start date is the user's specified date, not the day a retry happens to run.
    since=dt.datetime(2026,10,19,tzinfo=ZoneInfo('Asia/Tbilisi'))
    historical=since.replace(year=2025)
    existing=query('SELECT dataset_id,access_mode,capi_kinds FROM crm_projects WHERE project_id=?',[PROJECT])
    if existing:
        assert existing==[{'dataset_id':DATASET,'access_mode':'admin','capi_kinds':'qualified'}],'Existing configuration differs; review before changing it'
    else:
        query("INSERT INTO crm_projects(project_id,enabled_at,timezone,updated_at,access_mode,dataset_id,capi_kinds,capi_from,capi_setup_state) VALUES(?,?,'Asia/Tbilisi',?,'admin',?,'qualified',?,'pending')",[PROJECT,iso(now),iso(now),DATASET,iso(now)])
    source=query('SELECT project_id,account_id,app_id FROM crm_meta_sources WHERE page_id=?',[PAGE])
    if source:
        assert source==[{'project_id':PROJECT,'account_id':ACCOUNT,'app_id':APP}]
    else:
        query('INSERT INTO crm_meta_sources(page_id,project_id,account_id,app_id,live_since,history_from,history_to,next_attempt_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[PAGE,PROJECT,ACCOUNT,APP,iso(since),iso(historical),iso(now),iso(now),iso(now),iso(now)])
    status()
elif action=='status':status()
else:raise SystemExit(__doc__)
