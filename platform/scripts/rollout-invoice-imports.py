#!/usr/bin/env python3
"""Add archive tables only. Read-only unless --apply."""
import argparse,importlib.util,json
from pathlib import Path
s=importlib.util.spec_from_file_location('cf',Path(__file__).with_name('configure-client-access.py'));cf=importlib.util.module_from_spec(s);s.loader.exec_module(cf)
def q(sql):return cf.api('/d1/database/'+cf.DB+'/query','POST',{'sql':sql})[0]['results']
p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');a=p.parse_args()
names={'invoice_import_records','invoice_import_mappings','project_billing_profiles'}
existing={r['name'] for r in q("SELECT name FROM sqlite_master WHERE type='table'")}&names
assert not existing or existing==names,'Partial schema; inspect first'
protected=['projects','leads','weekly_reports','project_monthly_reports','crm_milestones','project_invoices','project_invoice_defaults']
before={t:q('SELECT COUNT(*) n FROM '+t)[0]['n'] for t in protected}
if a.apply and not existing:q(Path('migrations/0032_invoice_imports.sql').read_text())
assert before=={t:q('SELECT COUNT(*) n FROM '+t)[0]['n'] for t in protected}
print(json.dumps({'apply':a.apply,'existing':sorted(existing),'protected_counts':before}))
