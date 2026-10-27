#!/usr/bin/env python3
"""Roll out the verified, read-only VISA KeyCRM connector on the existing Worker.

Usage: python scripts/rollout-keycrm.py status|schema|activate|pause
The API credential stays in the encrypted Worker binding.
"""
import json
import pathlib
import runpy
import sys

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
    assert action in ('status','schema','activate','pause'),__doc__
    p,settings=status()
    tables={r['name'] for r in query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('keycrm_sync','keycrm_cards')")[0]['results']}
    assert not tables or tables=={'keycrm_sync','keycrm_cards'},'Partial KeyCRM schema; inspect before proceeding'
    if action=='schema' and not tables:
        query((ROOT.parent/'migrations/0035_keycrm.sql').read_text())
        tables={'keycrm_sync','keycrm_cards'}
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
    state=query('SELECT project_id,state,mapping_json,active_scan_id,next_page,expected_total,last_good_at,first_good_at,last_error,next_attempt_at FROM keycrm_sync WHERE project_id=?',[PROJECT])[0]['results'] if tables else []
    totals=query('SELECT COUNT(*) AS cards,SUM(present) AS present,SUM(CASE WHEN first_qualified_observed_at IS NOT NULL THEN 1 ELSE 0 END) AS qualified FROM keycrm_cards c JOIN keycrm_sync s ON s.project_id=c.project_id AND s.active_scan_id=c.scan_id WHERE c.project_id=?',[PROJECT])[0]['results'] if state else []
    print(json.dumps({'project':SLUG,'schemaReady':bool(tables),'config':settings.get('crmKeyCRM'),'state':state,'totals':totals},ensure_ascii=False))

if __name__=='__main__':main()
