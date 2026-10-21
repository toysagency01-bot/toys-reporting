#!/usr/bin/env python3
"""Apply the user's first-count rule to unresolved BSCLINIC monthly source notes.
Read-only by default. Updates use the exact previous JSON and version as a guard.
"""
import argparse,copy,hashlib,importlib.util,json
from pathlib import Path

def module(name,file):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(file));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
counts=module('counts','bsclinic-monthly-counts.py');cf=module('cf','configure-client-access.py')
def query(sql):return cf.api('/d1/database/'+cf.DB+'/query','POST',{'sql':sql})
def q(value):return "'"+str(value).replace("'","''")+"'"
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');a=p.parse_args()
    reports=query("SELECT * FROM project_monthly_reports WHERE project_id='prj_bs_clinic_a5b4' ORDER BY period_end DESC")[0]['results'];plan=[]
    for report in reports:
        before=json.loads(report['campaigns_json']);after=[counts.resolve_row(r) for r in before]
        changes=[{'id':x['id'],'campaign':x['name'],'before':{k:x.get(k) for k in ['appointments','patients','deferredLeads']},'after':{k:y.get(k) for k in ['appointments','patients','deferredLeads']}} for x,y in zip(before,after) if x!=y]
        if not changes:continue
        # Advertising, revenue, campaign identity and all other values must stay intact.
        allowed={'appointments','patients','deferredLeads','unconfirmed','sourceAnnotations'}
        assert all({k:v for k,v in x.items() if k not in allowed}=={k:v for k,v in y.items() if k not in allowed} for x,y in zip(before,after))
        plan.append({'record':report,'rows':after,'changes':changes})
    result={'reports':len(plan),'rows':sum(len(p['changes']) for p in plan),'resolvedMainCounts':sum(sum(c['before'][k] is None and c['after'][k] is not None for k in ['appointments','patients']) for p in plan for c in p['changes']),'deferredLeads':sum(r.get('deferredLeads') or 0 for p in plan for r in p['rows']),'apply':a.apply}
    if a.apply:
        target=Path('dist/bsclinic-monthly');target.mkdir(parents=True,exist_ok=True);(target/'before-count-rule.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
        for item in plan:
            record=item['record'];after=json.dumps(item['rows'],ensure_ascii=False);key='bs-count-rule-'+hashlib.sha256((record['id']+after).encode()).hexdigest()[:40]
            before_log={'period':record['period_start']+' — '+record['period_end'],'version':record['version'],'results':[{'campaign':c['campaign'],**c['before']} for c in item['changes']]};after_log={'actor':'system:bsclinic-approved-count-rule','version':record['version']+1,'results':[{'campaign':c['campaign'],**c['after']} for c in item['changes']]}
            scope="project_id='prj_bs_clinic_a5b4' AND id="+q(record['id'])
            sql="UPDATE project_monthly_reports SET campaigns_json="+q(after)+",version=version+1,updated_by='system:bsclinic-approved-count-rule',last_write_key="+q(key)+",updated_at=datetime('now') WHERE "+scope+' AND version='+str(record['version'])+' AND campaigns_json='+q(record['campaigns_json'])+';'
            sql+="INSERT INTO audit_log(project_id,action,entity_type,entity_id,before_json,after_json,request_id) SELECT project_id,'monthly.updated','monthly_report',id,"+q(json.dumps(before_log,ensure_ascii=False))+','+q(json.dumps(after_log,ensure_ascii=False))+','+q(key)+' FROM project_monthly_reports WHERE '+scope+' AND last_write_key='+q(key)+' AND NOT EXISTS(SELECT 1 FROM audit_log WHERE project_id=\'prj_bs_clinic_a5b4\' AND request_id='+q(key)+');'
            executed=query(sql);assert executed[0]['meta']['changes']==1,'Concurrent report edit: reload the plan before retrying'
            saved=query('SELECT campaigns_json FROM project_monthly_reports WHERE '+scope)[0]['results'][0]
            assert json.loads(saved['campaigns_json'])==item['rows']
        (target/'count-rule-rollout.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result))
