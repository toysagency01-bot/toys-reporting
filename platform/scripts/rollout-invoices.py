#!/usr/bin/env python3
"""Add invoice tables only. Defaults to a read-only preflight."""
import argparse, importlib.util, json
from pathlib import Path
s=importlib.util.spec_from_file_location('cf',Path(__file__).with_name('configure-client-access.py'))
cf=importlib.util.module_from_spec(s);s.loader.exec_module(cf)
def query(sql):return cf.api('/d1/database/'+cf.DB+'/query','POST',{'sql':sql})[0]['results']
tables={'project_invoice_defaults','project_invoice_counters','project_invoices','project_invoice_writes'}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    existing={r['name'] for r in query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'project_invoice%'")}
    assert not existing or existing==tables, 'Unexpected partial invoice schema; inspect before proceeding.'
    protected=['projects','leads','weekly_reports','project_monthly_reports','crm_milestones']
    before={t:query('SELECT COUNT(*) n FROM '+t)[0]['n'] for t in protected}
    if args.apply and not existing:query(Path('migrations/0031_project_invoices.sql').read_text())
    if args.apply or existing:
        assert {r['name'] for r in query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'project_invoice%'")}==tables
        assert {r['name'] for r in query('PRAGMA table_info(project_invoices)')}=={'id','project_id','number','number_key','data_json','version','duplicated_from','last_write_key','deleted_at','created_at','updated_at'}
    result={'migration':'0031_project_invoices','apply':args.apply,'existing':sorted(existing),'protected_counts':before}
    if args.apply:result['invoice_counts']={t:query('SELECT COUNT(*) n FROM '+t)[0]['n'] for t in sorted(tables)};Path('dist/invoices-schema-rollout.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result))
