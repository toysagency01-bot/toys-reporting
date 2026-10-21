#!/usr/bin/env python3
"""Reviewed BSCLINIC-only, insert-only import. Default is read-only preflight.
Run extraction first, then this script with --apply after reviewing the manifest.
"""
import argparse,hashlib,importlib.util,json
from pathlib import Path
s=importlib.util.spec_from_file_location('cf',Path(__file__).with_name('configure-client-access.py'));cf=importlib.util.module_from_spec(s);s.loader.exec_module(cf)
def query(sql,params=None):return cf.api('/d1/database/'+cf.DB+'/query','POST',{'sql':sql,'params':params or []})[0]['results']
def fp(value):return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
def baseline():
    return {table:query('SELECT COUNT(*) AS n FROM '+table)[0]['n'] for table in ['projects','project_tabs','weekly_reports','content_items','leads','integrations','project_memberships']}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--manifest',type=Path,default=Path('dist/bsclinic-monthly/manifest.json'));parser.add_argument('--apply',action='store_true');args=parser.parse_args();m=json.loads(args.manifest.read_text());assert m['project']=='bs-clinic-a5b4' and len(m['reports'])==12
    project=query("SELECT id,slug FROM projects WHERE slug='bs-clinic-a5b4'");assert project==[{'id':'prj_bs_clinic_a5b4','slug':'bs-clinic-a5b4'}]
    exists=bool(query("SELECT name FROM sqlite_master WHERE type='table' AND name='project_monthly_reports'"));prior=query("SELECT * FROM project_monthly_reports WHERE project_id='prj_bs_clinic_a5b4'") if exists else []
    plan={'project':m['project'],'periods':len(m['reports']),'campaignRows':sum(len(r['rows']) for r in m['reports']),'existing':len(prior),'sourceHash':m['reports'][0]['source']['sha256'],'apply':args.apply}
    if not args.apply:print(json.dumps(plan));raise SystemExit(0)
    before=baseline();backup={'baseline':before,'existingMonthly':prior};Path('dist/bsclinic-monthly/before.json').write_text(json.dumps(backup,ensure_ascii=False,indent=2))
    query(Path('migrations/0029_bsclinic_monthly.sql').read_text())
    inserted=0
    for report in m['reports']:
        assert report['id']=='bs-monthly-'+report['from'] and report['currency']=='CZK' and report['source']['sheet']=='Месячная сводка'
        old=query('SELECT * FROM project_monthly_reports WHERE project_id=? AND period_start=? AND period_end=?',[project[0]['id'],report['from'],report['to']])
        if old:
            assert len(old)==1 and json.loads(old[0]['source_json']).get('sha256')==report['source']['sha256'],'Existing report uses a different source; reconcile instead of overwriting'
            continue
        query("INSERT INTO project_monthly_reports(id,project_id,period_start,period_end,currency,campaigns_json,summary,source_json) VALUES(?,?,?,?,'CZK',?,?,?)",[report['id'],project[0]['id'],report['from'],report['to'],json.dumps(report['rows'],ensure_ascii=False),report['summary'],json.dumps(report['source'],ensure_ascii=False)])
        saved=query('SELECT * FROM project_monthly_reports WHERE id=? AND project_id=?',[report['id'],project[0]['id']])[0]
        assert saved['version']==1 and json.loads(saved['campaigns_json'])==report['rows'] and saved['summary']==report['summary'];inserted+=1
    after=baseline();assert before==after,'Existing platform records changed during import'
    rows=query("SELECT id,campaigns_json,period_start,period_end,source_json FROM project_monthly_reports WHERE project_id='prj_bs_clinic_a5b4' ORDER BY period_end DESC")
    assert all(any(row['id']==r['id'] for row in rows) for r in m['reports'])
    result={**plan,'inserted':inserted,'verified':True,'preservedCountsHash':fp(after),'rowsVerified':sum(len(json.loads(r['campaigns_json'])) for r in rows),'latest':rows[0]['period_end'],'earliest':rows[-1]['period_start']}
    Path('dist/bsclinic-monthly/rollout.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
