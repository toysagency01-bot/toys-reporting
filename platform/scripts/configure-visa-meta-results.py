#!/usr/bin/env python3
"""Configure VISA Results from each Meta ad set and request a scoped reimport.
Run only after deploying the tested resultMode=adset_optimization importer.
Usage: python scripts/configure-visa-meta-results.py status|apply
Prints only the selected non-secret mapping/status fields.
"""
import datetime
import json
import pathlib
import runpy
import sys
CF=runpy.run_path(str(pathlib.Path(__file__).with_name('configure-client-access.py')))
def query(sql,params=None):
    result=CF['api']('/d1/database/'+CF['DB']+'/query','POST',{'sql':sql,'params':params or []})
    assert result and all(r.get('success') for r in result),'D1 query failed'
    return result[0]
def status():
    return query("SELECT i.id,i.external_account_id,json_extract(i.config_json,'$.resultActionTypes') AS fallbackActionTypes,json_extract(i.config_json,'$.resultMode') AS resultMode,json_extract(i.config_json,'$.conversionMappingRevision') AS mappingRevision,json_extract(i.config_json,'$.refreshRequestedAt') AS refreshRequestedAt,s.state,s.last_success_at,s.last_error_code,s.next_attempt_at FROM integrations i LEFT JOIN ads_import_status s ON s.integration_id=i.id WHERE i.id='int_visa_meta' AND i.project_id='prj_visa_agency_qa3b' AND i.provider='meta_ads' AND i.external_account_id='582816622143849' AND i.status='active'")['results']
if __name__=='__main__':
    action=sys.argv[1] if len(sys.argv)==2 else ''
    assert action in ('status','apply'),__doc__
    before=status();assert len(before)==1,'VISA integration identity mismatch'
    if action=='apply':
        assert before[0]['fallbackActionTypes']=='["lead"]','Review the existing fallback before editing'
        assert before[0]['resultMode'] in (None,'adset_optimization')
        at=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
        r=query("UPDATE integrations SET config_json=json_set(config_json,'$.resultMode','adset_optimization','$.conversionMappingRevision','meta-adset-results-v2','$.insightChunkDays',1,'$.refreshRequestedAt',?) WHERE id='int_visa_meta' AND project_id='prj_visa_agency_qa3b' AND external_account_id='582816622143849' AND json_extract(config_json,'$.resultMode') IS ? AND json_extract(config_json,'$.conversionMappingRevision') IS ?",[at,before[0]['resultMode'],before[0]['mappingRevision']])
        assert r['meta']['changes']==1,'Integration mapping changed concurrently'
        query("UPDATE ads_import_status SET next_attempt_at=NULL WHERE integration_id='int_visa_meta' AND (lease_until IS NULL OR lease_until<?)",[at])
        saved=status();assert saved[0]['resultMode']=='adset_optimization' and saved[0]['refreshRequestedAt']==at
    print(json.dumps(status(),ensure_ascii=False))
