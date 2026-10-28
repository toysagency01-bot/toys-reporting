#!/usr/bin/env python3
"""Roll out the verified, read-only VISA KeyCRM connector on the existing Worker.

Usage: python scripts/rollout-keycrm.py status|schema|activate|pause|filter-toys|campaigns
The API credential stays in the encrypted Worker binding.
"""
import json
import pathlib
import runpy
import sys
import datetime

ROOT=pathlib.Path(__file__).resolve().parent
CF=runpy.run_path(str(ROOT/'configure-client-access.py'))
WORKER=runpy.run_path(str(ROOT/'release-unified.py'))
PROJECT='prj_visa_agency_qa3b'
SLUG='visa-agency-qa3b'
LABELS=['Прогріти','Жовтий','Зелені']

def query(sql,params=None):
    results=CF['api']('/d1/database/'+CF['DB']+'/query','POST',{'sql':sql,'params':params or []})
    assert results and all(r.get('success') for r in results),'D1 query failed'
    return results

def status():
    p=query('SELECT timezone,settings_json FROM projects WHERE id=? AND slug=?',[PROJECT,SLUG])[0]['results']
    assert len(p)==1 and p[0]['timezone']=='Europe/Warsaw','Project identity/timezone changed'
    return p[0],json.loads(p[0]['settings_json'] or '{}')

def main():
    action=sys.argv[1] if len(sys.argv)==2 else ''
    assert action in ('status','schema','activate','pause','filter-toys','campaigns'),__doc__
    p,settings=status()
    tables={r['name'] for r in query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('keycrm_sync','keycrm_cards')")[0]['results']}
    assert not tables or tables=={'keycrm_sync','keycrm_cards'},'Partial KeyCRM schema; inspect before proceeding'
    if action=='schema' and not tables:
        query((ROOT.parent/'migrations/0035_keycrm.sql').read_text())
        tables={'keycrm_sync','keycrm_cards'}
    columns={r['name'] for r in query("SELECT name FROM pragma_table_info('keycrm_cards')")[0]['results']} if tables else set()
    sync_columns={r['name'] for r in query("SELECT name FROM pragma_table_info('keycrm_sync')")[0]['results']} if tables else set()
    source_ready='utm_source' in columns and {'source_filter','scan_filter'}<=sync_columns
    if action in ('schema','filter-toys') and not source_ready:
        assert tables,'Apply the base KeyCRM schema first'
        assert 'utm_source' not in columns and not {'source_filter','scan_filter'}&sync_columns,'Partial source-filter schema'
        query((ROOT.parent/'migrations/0036_keycrm_source.sql').read_text())
        source_ready=True
    campaign_columns={'campaign_provider','campaign_account_id','campaign_id','attribution_state'}
    campaign_sync={'scan_attribution_revision','attribution_revision'}
    campaign_ready=campaign_columns<=columns and campaign_sync<=sync_columns
    if action in ('schema','campaigns') and not campaign_ready:
        assert source_ready,'Apply source-filter schema first'
        assert not campaign_columns&columns and not campaign_sync&sync_columns,'Partial campaign-attribution schema'
        query((ROOT.parent/'migrations/0038_keycrm_campaigns.sql').read_text())
        campaign_ready=True
    if action=='campaigns':
        assert settings.get('crmKeyCRM',{}).get('syncEnabled'),'KeyCRM is disabled'
        at=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
        r=query("UPDATE keycrm_sync SET next_attempt_at=? WHERE project_id=? AND (lease_until IS NULL OR lease_until<?)",[at,PROJECT,at])[0]
        assert r['meta']['changes']==1,'A scan is active; allow its lease to finish before requesting another'
    if action=='filter-toys':
        at=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
        lease=query('SELECT lease_until FROM keycrm_sync WHERE project_id=?',[PROJECT])[0]['results']
        assert len(lease)==1 and (not lease[0]['lease_until'] or lease[0]['lease_until']<at),'KeyCRM scan in progress; retry after its lease ends'
        config=settings['crmKeyCRM'];assert config.get('syncEnabled') and config['secretName']=='KEYCRM_VISA_API_TOKEN'
        config={**config,'sourceFilter':{'utm_source':'toys'},'sourceFilterRevision':'utm-source-toys-v1'}
        r=query("UPDATE projects SET settings_json=json_set(settings_json,'$.crmKeyCRM',json(?)) WHERE id=? AND slug=? AND settings_json IS ?",[json.dumps(config,ensure_ascii=False),PROJECT,SLUG,p['settings_json']])[0]
        assert r['meta']['changes']==1,'Concurrent project configuration change'
        r=query("UPDATE keycrm_sync SET scan_id=NULL,scan_started_at=NULL,scan_filter=NULL,next_page=1,expected_total=NULL,state='pending',attempts=0,last_error=NULL,next_attempt_at=? WHERE project_id=? AND (lease_until IS NULL OR lease_until<?)",[at,PROJECT,at])[0]
        assert r['meta']['changes']==1,'A scheduled scan started; inspect its result before requesting another refresh'
        _,settings=status();assert settings['crmKeyCRM']==config
    if action in ('activate','pause'):
        assert tables,'Apply the schema before activation'
        config=settings['crmKeyCRM']
        assert config['secretName']=='KEYCRM_VISA_API_TOKEN' and config['qualifiedLabels'] in (LABELS,['Прогріті','Жовтий','Зелені'])
        assert any(b['name']=='KEYCRM_VISA_API_TOKEN' and b['type']=='secret_text' for b in WORKER['api']('/settings')['bindings'])
        if action=='activate':
            report=settings.get('crmKeyCRMVerification',{})
            assert report.get('ok'),'Live Worker API contract verification has not passed'
            assert report.get('scopeVerification',{}).get('ok'),'Filtered API scope has not been verified'
            matches=[r for r in report['pipelines'] if all(sum(s.get('title')==label for s in r['statuses'])==1 for label in LABELS)]
            assert len(matches)==1,'Qualification pipeline is absent or ambiguous'
            assert all(k in report['cardShape'] for k in ('id','pipeline_id','status_id','created_at')),'Unverified card contract'
        config={**config,'qualifiedLabels':LABELS,'syncEnabled':action=='activate','state':'enabled' if action=='activate' else 'paused'}
        r=query("UPDATE projects SET settings_json=json_set(settings_json,'$.crmKeyCRM',json(?)) WHERE id=? AND slug=? AND settings_json IS ?",[json.dumps(config,ensure_ascii=False),PROJECT,SLUG,p['settings_json']])[0]
        assert r['meta']['changes']==1,'Concurrent configuration change'
        _,saved=status();assert saved['crmKeyCRM']==config
        settings=saved
    state=query('SELECT project_id,state,mapping_json,active_scan_id,next_page,expected_total,last_good_at,first_good_at,last_error,next_attempt_at'+(',source_filter' if source_ready else '')+(',attribution_revision' if campaign_ready else '')+' FROM keycrm_sync WHERE project_id=?',[PROJECT])[0]['results'] if tables else []
    for item in state:
        if item.get('mapping_json'):
            mapping=json.loads(item['mapping_json']);catalogue=mapping.pop('campaigns',[])
            item['mapping_json']=mapping;item['campaignCatalogueSize']=len(catalogue)
    totals=query("SELECT COUNT(*) AS scannedCards,SUM(present) AS present,SUM(CASE WHEN first_qualified_observed_at IS NOT NULL AND utm_source='toys' THEN 1 ELSE 0 END) AS toysQualified FROM keycrm_cards c JOIN keycrm_sync s ON s.project_id=c.project_id AND s.active_scan_id=c.scan_id WHERE c.project_id=?",[PROJECT])[0]['results'] if state and source_ready else []
    print(json.dumps({'project':SLUG,'schemaReady':bool(tables),'sourceSchemaReady':source_ready,'campaignSchemaReady':campaign_ready,'config':settings.get('crmKeyCRM'),'state':state,'totals':totals},ensure_ascii=False))

if __name__=='__main__':main()
