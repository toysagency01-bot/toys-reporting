#!/usr/bin/env python3
"""Add the isolated finance schema and optionally load private contract settings.
No transactions or historical money are imported. The --config file must remain
outside Git. Default action is a read-only preflight.
"""
import argparse,importlib.util,json,pathlib,hashlib
s=importlib.util.spec_from_file_location('cf',pathlib.Path(__file__).with_name('configure-client-access.py'));cf=importlib.util.module_from_spec(s);s.loader.exec_module(cf)
def query(sql,params=None):return cf.api('/d1/database/'+cf.DB+'/query','POST',{'sql':sql,**({'params':params} if params else {})})[0]['results']
def quote(s):return "'"+s.replace("'","''")+"'"
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');p.add_argument('--config');a=p.parse_args()
 tables={'finance_state','finance_records','finance_writes','finance_bank_state','finance_bank_rates'};existing={r['name'] for r in query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'finance_%'")};assert not existing or existing==tables,'Partial finance schema; inspect before continuing.'
 protected={t:query('SELECT COUNT(*) n FROM '+t)[0]['n'] for t in ['projects','leads','project_invoices','project_monthly_reports','weekly_reports']}
 if a.apply and not existing:
  query(pathlib.Path('migrations/0033_finance.sql').read_text());query(pathlib.Path('migrations/0034_finance_bank.sql').read_text())
 inserted=0
 if a.apply and a.config:
  config=json.loads(pathlib.Path(a.config).read_text());assert set(config)=={'accounts','projects','rules'};assert not query("SELECT id FROM finance_records WHERE collection IN ('projects','rules') LIMIT 1"),'Contract settings already exist; do not overwrite edits.'
  rows=[]
  for collection in ['projects','rules']:
   for row in config[collection]:
    row=dict(row);rid=row.pop('id');rows.append((collection,rid,json.dumps(row,ensure_ascii=False,separators=(',',':'))))
  sql='\n'.join('INSERT INTO finance_records(collection,id,data_json) VALUES('+','.join(map(quote,r))+');' for r in rows);query(sql);inserted=len(rows)
 result={'apply':a.apply,'existing':sorted(existing),'settings_loaded':inserted,'protected_counts':protected}
 if a.apply:
  assert {r['name'] for r in query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'finance_%'")}==tables
  result['finance_counts']=query('SELECT collection,COUNT(*) n FROM finance_records GROUP BY collection');assert not query("SELECT id FROM finance_records WHERE collection='transactions' LIMIT 1"),'Unexpected finance transactions before launch.'
  pathlib.Path('dist/finance-schema-rollout.json').write_text(json.dumps(result,indent=2))
 print(json.dumps(result))
