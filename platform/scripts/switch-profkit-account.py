#!/usr/bin/env python3
"""Verified, atomic Profkit account switch. Old snapshots are never rewritten.
prepare: pending account metadata verification only (no expense imports).
switch: one SQL statement archives the old and activates the verified new account.
"""
import datetime,json,pathlib,runpy,sys
c=runpy.run_path(str(pathlib.Path(__file__).with_name('configure-client-access.py')));release=runpy.run_path(str(pathlib.Path(__file__).with_name('release-unified.py')))
P='prj_profkit_instashop_r4vk';OLD='native-meta-profkit-instashop-r4vk';NEW='native-meta-profkit-usa-2';ACCOUNT='1736244500266269';ROOT=pathlib.Path('/workspace/profkit-account-switch')
def q(sql,params=None):
 r=c['api']('/d1/database/'+c['DB']+'/query','POST',{'sql':sql,'params':params or []});assert all(x['success'] for x in r);return r[0]['results']
def capture(name):
 data=q('SELECT scope_key,local_date,content_hash,payload_json,checked_at FROM ads_daily_snapshots WHERE project_id=? AND integration_id=? ORDER BY scope_key,local_date',[P,OLD]);ROOT.mkdir(exist_ok=True);ROOT.chmod(0o700);path=ROOT/name;assert not path.exists(),'Preserve backup';path.write_text(json.dumps(data));path.chmod(0o600);return data
at=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z');action=sys.argv[1] if len(sys.argv)>1 else 'status'
if action in ('prepare','switch'):
 assert len(sys.argv)==3 and release['current']()==[{'version_id':sys.argv[2],'percentage':100}],'Active version changed'
 assert q("SELECT slug FROM projects WHERE id=? AND status='active'",[P])==[{'slug':'profkit-instashop-r4vk'}]
 if action=='prepare':
  assert q("SELECT external_account_id,status FROM integrations WHERE id=? AND project_id=?",[OLD,P])==[{'external_account_id':'394051718160331','status':'active'}]
  assert not q("SELECT id FROM integrations WHERE external_account_id=? AND provider='meta_ads'",[ACCOUNT]),'Account already registered'
  config={'pendingAccountSwitch':True,'verifyAccountMetadata':True,'allowCurrencyDiscovery':True,'apiVersion':'v26.0','discoverCreatedTime':True,'accountName':'Profkit USA 2.0','refreshRequestedAt':at,'reconcileAccountTotals':True}
  q("INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES(?,?,'meta_ads',?,'pending',?)",[NEW,P,ACCOUNT,json.dumps(config,separators=(',',':'))])
 else:
  new=q("SELECT config_json FROM integrations WHERE id=? AND project_id=? AND external_account_id=? AND status='pending'",[NEW,P,ACCOUNT]);assert len(new)==1
  cfg=json.loads(new[0]['config_json']);assert cfg.get('accountMetadataCheckedAt') and cfg.get('expectedCurrency') and cfg.get('accountTimezone'),'Account not verified'
  dates=q('SELECT MIN(local_date) first,MAX(local_date) last FROM ads_daily_snapshots WHERE project_id=? AND integration_id=?',[P,OLD]);assert dates[0]['last'];end=dates[0]['last']
  # Both status changes happen together; a live import lease defers the switch.
  changed=q("UPDATE integrations SET status=CASE WHEN id=? THEN 'disabled' ELSE 'active' END,config_json=CASE WHEN id=? THEN json_set(config_json,'$.readOnlyArchive',json('true'),'$.archiveThroughDate',?,'$.accountName','Profkit — прежний кабинет') ELSE json_remove(json_set(config_json,'$.refreshRequestedAt',?),'$.pendingAccountSwitch') END,updated_at=datetime('now') WHERE project_id=? AND id IN (?,?) AND (SELECT status FROM integrations WHERE id=?)='active' AND (SELECT status FROM integrations WHERE id=?)='pending' AND NOT EXISTS(SELECT 1 FROM ads_import_status WHERE integration_id IN (?,?) AND lease_until>?) RETURNING id,status",[OLD,OLD,end,at,P,OLD,NEW,OLD,NEW,OLD,NEW,at]);assert len(changed)==2,'Import lease active or configuration changed; retry after completion'
  capture('frozen-old.json')
  q("INSERT INTO audit_log(project_id,action,entity_type,entity_id,after_json) VALUES(?,'ads.account.switched','project',?,?)",[P,P,json.dumps({'oldAccount':'394051718160331','newAccount':ACCOUNT,'oldHistoryPreserved':True,'at':at})])
if action=='verify':
 before=json.loads((ROOT/'frozen-old.json').read_text());now=q('SELECT scope_key,local_date,content_hash,payload_json,checked_at FROM ads_daily_snapshots WHERE project_id=? AND integration_id=? ORDER BY scope_key,local_date',[P,OLD]);assert before==now,'Archived history changed';print(json.dumps({'archiveUnchanged':True,'archivedDays':len(now)}))
print(json.dumps({'integrations':q('SELECT id,external_account_id,status,config_json FROM integrations WHERE project_id=? AND id IN (?,?)',[P,OLD,NEW]),'imports':q('SELECT integration_id,state,last_success_at,last_error_code FROM ads_import_status WHERE project_id=?',[P])}))
