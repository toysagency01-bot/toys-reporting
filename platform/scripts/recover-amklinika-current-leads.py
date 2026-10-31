#!/usr/bin/env python3
"""Recover explicitly dated AM Klinika Meta rows from a private Sheets capture.
No existing lead/status/notes/tombstone is modified. No CAPI event is generated.
Usage: script PRIVATE_SOURCE_JSON YYYY-MM-DD [apply]
"""
import datetime,hashlib,json,pathlib,runpy,sys,zoneinfo
c=runpy.run_path(str(pathlib.Path(__file__).with_name('configure-client-access.py')))
PID='prj_amklinika_k8m2';BOOK='1CUG7bljcemLqnKNq0nv4tpKtNGH4GDIbeQB2fDH5sSM'
source=json.loads(pathlib.Path(sys.argv[1]).read_text());target=sys.argv[2];apply=len(sys.argv)>3 and sys.argv[3]=='apply';today=datetime.date.fromisoformat(target)
assert source['range'].startswith('Lead_meta_cz_mechanic!'),'Source sheet mismatch'
def q(sql,params=None):
 r=c['api']('/d1/database/'+c['DB']+'/query','POST',{'sql':sql,'params':params or []});assert all(x['success'] for x in r);return r[0]['results']
def digest(v):return hashlib.sha256(v.encode()).hexdigest()
project=q('SELECT id,slug,timezone FROM projects WHERE id=? AND status=\'active\'',[PID]);assert len(project)==1 and project[0]['slug']=='amklinika-k8m2'
before=q('SELECT id,current_status,metadata_json,deleted_at FROM leads WHERE project_id=? ORDER BY id',[PID]);beforeHash=digest(json.dumps(before,sort_keys=True))
candidates=[]
for raw in source['values']:
 r=[str(v or '') for v in raw]+['']*16
 assert r[0].startswith('l:') and r[0][2:].isdigit()
 when=datetime.datetime.fromisoformat(r[1]);assert when.tzinfo
 assert when.astimezone(zoneinfo.ZoneInfo('Europe/Prague')).date()==today,'Wrong project-local date'
 key=r[0][2:];phone=r[14].removeprefix('p:');assert phone or r[15],'No contact'
 matches=q('SELECT id,deleted_at FROM leads WHERE project_id=? AND (external_lead_id=? OR json_extract(metadata_json,\'$.leadgenId\')=?)',[PID,key,key]);assert len(matches)<=1
 candidates.append((r,key,phone,when,matches))
assert len({x[1] for x in candidates})==len(candidates)
created=0
for r,key,phone,when,matches in candidates:
 if matches:continue
 if not apply:continue
 identifier='lead_amklinika_'+digest(key)[:24];at=when.astimezone(datetime.timezone.utc).isoformat().replace('+00:00','Z')
 metadata={'migration':'amklinika-current-recovery-v1','sourceWorkbook':BOOK,'sourceSheet':'Lead_meta_cz_mechanic','sourceDate':r[1],'leadgenId':key,'formId':r[8].removeprefix('f:'),'sourceAdId':r[2].removeprefix('ag:'),'adAttribution':{'version':1,'provider':'meta_ads','accountId':'1830858661278666','adId':r[2].removeprefix('ag:'),'adsetId':r[4].removeprefix('as:'),'campaignId':r[6].removeprefix('c:')}}
 q("INSERT INTO leads(id,project_id,source_provider,external_lead_id,campaign_external_id,created_at,name,phone,email,current_status,metadata_json) SELECT ?,?,'legacy_project_sheet',?,?,?,?,?,?,'Новый',? WHERE NOT EXISTS(SELECT 1 FROM leads WHERE project_id=? AND (external_lead_id=? OR json_extract(metadata_json,'$.leadgenId')=?)) ON CONFLICT DO NOTHING",[identifier,PID,key,metadata['adAttribution']['campaignId'],at,r[13],phone,r[15],json.dumps(metadata),PID,key,key])
 q("INSERT INTO lead_status_events(id,project_id,lead_id,to_status,changed_at,note) SELECT ?,?,id,'Новый',?,? FROM leads WHERE id=? AND project_id=? AND json_extract(metadata_json,'$.migration')='amklinika-current-recovery-v1' ON CONFLICT DO NOTHING",['evt_am_recovery_'+digest(key)[:24],PID,at,'am-current:'+key,identifier,PID])
 q("INSERT INTO audit_log(project_id,action,entity_type,entity_id,request_id,after_json) SELECT ?,'crm.lead.recovered','lead',?,?,? WHERE NOT EXISTS(SELECT 1 FROM audit_log WHERE request_id=?)",[PID,identifier,'am-current:'+key,json.dumps({'source':'verified_project_sheet','date':target,'actor':'user_requested_recovery'}),'am-current:'+key]);created+=1
if apply:
 unchanged=q('SELECT id,current_status,metadata_json,deleted_at FROM leads WHERE project_id=? ORDER BY id',[PID]);oldids={r['id'] for r in before};assert digest(json.dumps([r for r in unchanged if r['id'] in oldids],sort_keys=True))==beforeHash,'Existing leads changed'
 for _,key,_,_,_ in candidates:assert len(q("SELECT id FROM leads WHERE project_id=? AND (external_lead_id=? OR json_extract(metadata_json,'$.leadgenId')=?)",[PID,key,key]))==1
print(json.dumps({'applied':apply,'date':target,'projectTimezone':'Europe/Prague','sourceRows':len(candidates),'alreadyPresent':sum(bool(x[4]) for x in candidates),'missingBefore':sum(not x[4] for x in candidates),'created':created,'existingLeadsPreserved':True}))
