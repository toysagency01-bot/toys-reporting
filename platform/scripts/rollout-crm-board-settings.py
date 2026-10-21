#!/usr/bin/env python3
"""Add only the board-settings table; default mode is read-only preflight."""
import argparse, importlib.util, json
from pathlib import Path
s=importlib.util.spec_from_file_location('cf',Path(__file__).with_name('configure-client-access.py'))
cf=importlib.util.module_from_spec(s);s.loader.exec_module(cf)
def query(sql):return cf.api('/d1/database/'+cf.DB+'/query','POST',{'sql':sql})[0]['results']
def counts():return {t:query('SELECT COUNT(*) AS n FROM '+t)[0]['n'] for t in ['projects','leads','lead_status_events','crm_boards','project_memberships','weekly_reports']}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    exists=bool(query("SELECT name FROM sqlite_master WHERE type='table' AND name='crm_board_settings'"))
    before=counts()
    if args.apply and not exists:query(Path('migrations/0030_crm_board_settings.sql').read_text())
    if exists or args.apply:
        assert {r['name'] for r in query('PRAGMA table_info(crm_board_settings)')}=={'project_id','board_key','name','pipeline_json','version','claim_token','updated_at'}
    result={'table':'crm_board_settings','existed':exists,'apply':args.apply,'before':before,'after':counts() if args.apply else before}
    if args.apply:Path('dist/crm-board-settings-rollout.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result))
