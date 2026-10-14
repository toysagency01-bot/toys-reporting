#!/usr/bin/env python3
"""Restore approved seven-project private CRM captures, without CAPI replays.

prepare PRIVATE_ROOT | apply PRIVATE_ROOT (--sqlite FILE | --cloudflare)
Only contact-bearing source rows with a usable received date become leads.
Raw source/feedback rows are retained in the restricted source-history archive.
Existing leads, including edits and deletion tombstones, are never overwritten.
"""
import argparse, collections, hashlib, importlib.util, json, os, re, sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
BASE=Path(__file__).resolve().parents[1]
PLAN=json.loads((BASE/'imports/rollout-20261013.json').read_text())
PROVIDER='legacy_project_sheet'
def sha(v):return hashlib.sha256(v.encode()).hexdigest()
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,separators=(',',':')));p.chmod(0o600)
def rows(c):
 out=[]
 for g in c['data']['sheets'][0].get('data',[]):
  for i,r in enumerate(g.get('rowData',[])):
   vals=[str(v.get('formattedValue',v.get('effectiveValue',{}).get('stringValue',''))).strip() for v in r.get('values',[])]
   if any(vals):out.append(((g.get('startRow',0)+i+1),vals))
 return out
def timestamp(raw,tz):
 s=str(raw).strip()
 if not s or s=='0':return None
 s=re.sub(r'^(\d{4}-\d\d-\d\d) (\d):',r'\1 0\2:',s)
 try:d=datetime.fromisoformat(s.replace('Z','+00:00'))
 except ValueError:
  s=re.sub(r'\.\s+(?=\d)', '.',s)
  d=None
  # US-formatted strings occur in older imports. Typed Sheets dates take precedence below.
  for fmt in ['%d.%m.%Y, %H:%M:%S','%d.%m.%Y %H:%M:%S','%d.%m.%Y %H:%M','%d.%m.%Y','%d.%m.%y','%m.%d.%Y','%m.%d.%y','%m/%d/%y %H:%M','%m/%d/%y, %H:%M','%m/%d/%y, %I:%M %p','%d/%m/%Y %H:%M:%S']:
   try:d=datetime.strptime(s,fmt);break
   except ValueError:pass
  if d is None:return None
 if d.tzinfo is None:d=d.replace(tzinfo=ZoneInfo(tz))
 if not 2010<=d.year<=2026:return None
 return d.astimezone(timezone.utc).isoformat().replace('+00:00','Z')
def mapped_status(key,original):
 s=original.strip().casefold()
 if key=='amklinika':
  return {'нецелевой':'Неактуален','работа завершена':'Завершён'}.get(s,original or 'Новый')
 if key=='taycher':
  return {'unqualified':'Отказ','email sent':'Связались','uncontactable':'Не удалось связаться','working':'Связались','follow-up call':'Связались','lost sale':'Отказ','meeting scheduled':'Связались','meeting done':'Связались','into call':'Связались'}.get(s,'Новый')
 return {'не обработан':'Новый','идёт общение':'В работе','идет общение':'В работе','не отвечает':'В работе','отложенный лид':'В работе','запись':'В работе','оплата':'Продажа','отказ (иные причины)':'Не подходит','отказ (цена)':'Не подходит','не вышел на связь':'В работе','не целевой':'Не подходит','ql: целевой':'Квалифицирован'}.get(s,'Новый')
# Explicit source column maps. Status/notes are excluded from immutable identity.
MAPS={
 'taycher':{19684764:dict(date=0,name=5,phone=6,email=7,status=8,note=9,budget=4),357434940:dict(date=0,name=4,phone=5,email=6,status=7,note=8,budget=3),374837659:dict(date=0,name=5,phone=6,email=7,status=8,note=9,budget=3)},
 'monorey':{684083261:dict(date=0,name=1,phone=2,status=5,note=6),193098408:dict(date=0,name=1,phone=2,status=5,note=6),1479817097:dict(date=23,name=0,phone=1,status=7),40089341:dict(date=0,name=1,phone=2),807609954:dict(date=0,name=2,phone=3,status=6,note=7)},
 'murmur':{1387623982:dict(date=0,name=1,phone=2,status=5,note=6),74968527:dict(date=0,name=1,phone=2,status=5,note=6)},
 'visa':{1133913350:dict(date=0,name=3,phone=4,email=5,status=10,note=12)},
 'amklinika':{258218750:dict(date=0,name=1,surname=2,phone=3)}
}
META_TABS={386002818,1039108541,1949705827,1027581730}
def prepare(root):
 output=[];summaries=[];quarantine=[]
 for p in PLAN:
  book=p['projectBook'];key=p['key'];metadata=json.loads((root/f'sources/{book}.metadata.json').read_text());tz=metadata['properties']['timeZone']
  files=[json.loads(f.read_text()) for f in sorted((root/'private-contacts').glob(book+'.*.json'))]
  feedback={};matched=set();seen={};duplicates=0;unparsed=0;aggregate=0
  if key=='amklinika':
   for c in files:
    if c['properties']['title']=='LeadFeedback':feedback={r[0]:(r+['']*9)[:9]for _,r in rows(c)[1:]}
  for c in files:
   sheet=c['properties'];sid=sheet['sheetId'];title=sheet['title'];cols=MAPS.get(key,{}).get(sid)
   meta=key=='amklinika' and sid in META_TABS
   if not cols and not meta:
    if key=='visa':aggregate+=max(0,len(rows(c))-1)
    continue
   for n,raw in rows(c):
    if not meta and n==1:continue
    if meta and not re.fullmatch(r'l:\d+',raw[0]):continue
    r=raw+['']*60;get=lambda field:r[cols[field]] if cols and field in cols else ''
    external=r[0].removeprefix('l:') if meta else None
    name=r[13] if meta else ' '.join(filter(None,[get('name'),get('surname')]))
    phone=(r[14] if meta else get('phone')).removeprefix('p:')
    email=r[15] if meta else get('email');date=r[1] if meta else get('date')
    original=get('status');note=get('note');saved=None
    if key=='amklinika':
     if meta:
      candidates=[(fid,ff)for fid,ff in feedback.items()if ff[5]==title and ff[6]==r[0]]
     else:
      fid=sha(title+'\x1f'+'\x1f'.join(r[:8]))[:24];candidates=[(fid,feedback[fid])]if fid in feedback else []
     if len(candidates)>1:raise ValueError('Ambiguous feedback identity')
     if candidates:
      fid,saved=candidates[0];matched.add(fid);original=saved[1];note=saved[2];date=date if timestamp(date,tz) else saved[8]
    created=timestamp(date,tz)
    date_col=1 if meta else cols['date']
    for grid in c['data']['sheets'][0].get('data',[]):
     offset=n-1-grid.get('startRow',0)
     if 0<=offset<len(grid.get('rowData',[])):
      cells=grid['rowData'][offset].get('values',[]);typed=cells[date_col].get('effectiveValue',{}) if date_col<len(cells) else {}
      if 'numberValue' in typed and 40000<typed['numberValue']<50000:
       local=datetime(1899,12,30)+timedelta(seconds=round(typed['numberValue']*86400))
       created=timestamp(local.isoformat(),tz)
    if not created or not (name or phone or email):
     unparsed+=1;quarantine.append({'project':key,'sheet':title,'row':n,'reason':'received_date_missing_or_invalid' if not created else 'contact_missing'});continue
    status=mapped_status(key,original);changed=timestamp(saved[4] or saved[3],tz) if saved else None
    # A missing historical status-change time stays NULL; received date is not substituted.
    immutable=[value for index,value in enumerate(raw) if index not in {cols.get('status'),cols.get('note'),cols.get('date')}] if cols else []
    identity=external or sha(json.dumps([book,title,created,immutable],ensure_ascii=False))[:32]
    dupe=identity
    # Never merge unrelated submissions merely because a contact and day match.
    # Preserve separate source rows when their feedback conflicts.
    if dupe in seen and original and json.loads(seen[dupe]['metadata_json'])['legacyStatus'] and seen[dupe]['current_status']!=status:
     identity=sha(identity+':row:'+str(n))[:32];dupe=identity
    if dupe in seen:
     prev=seen[dupe];pm=json.loads(prev['metadata_json'])
     if prev['current_status']!=status and original:
      if pm['legacyStatus']:raise ValueError('Conflicting feedback for duplicated contact: '+key+'/'+title+'/'+str(n))
      prev['current_status']=status;prev['status_updated_at']=changed;pm['legacyStatus']=original;pm['description']=note;pm['legacyFeedback']=saved
     pm['sourceRows'].append({'sheetId':sid,'sheet':title,'row':n});prev['metadata_json']=json.dumps(pm,ensure_ascii=False,separators=(',',':'));duplicates+=1;continue
    info={'migration':'rollout-private-leads-v1','sourceWorkbook':book,'sourceSheet':title,'sourceRows':[{'sheetId':sid,'sheet':title,'row':n}], 'sourceTimezone':tz,'sourceDate':date,'legacyStatus':original,'legacyFeedback':saved,'description':note,'sourceAdId':r[2].removeprefix('ag:') if meta else '', 'formId':r[8].removeprefix('f:') if meta else '', 'leadgenId':external,'historicalStatusTimeKnown':bool(changed)}
    if meta:info['adAttribution']={'version':1,'provider':'meta_ads','accountId':p['metaAccount'],'adId':r[2].removeprefix('ag:'),'campaignId':r[6].removeprefix('c:'),'adsetId':r[4].removeprefix('as:')}
    item={'id':'lead_'+key+'_'+sha(identity)[:24],'project_id':p['id'],'source_provider':PROVIDER,'external_lead_id':identity,'created_at':created,'name':name,'phone':phone,'email':email,'budget':get('budget'),'current_status':status,'status_updated_at':changed,'metadata_json':json.dumps(info,ensure_ascii=False,separators=(',',':'))}
    seen[dupe]=item
  output+=list(seen.values());summaries.append({'project':key,'leads':len(seen),'duplicatesMerged':duplicates,'rowsQuarantined':unparsed,'feedbackMatched':len(matched),'feedbackWithoutContactRow':len(feedback)-len(matched),'aggregateRowsArchivedOnly':aggregate,'statuses':dict(collections.Counter(l['current_status']for l in seen.values()))})
 save(root/'prepared/leads.json',output);save(root/'prepared/leads-quarantine.json',quarantine);save(root/'prepared/leads-summary.json',summaries)
 return summaries

def transfer(root,db,apply):
 records=json.loads((root/'prepared/leads.json').read_text());fields=list(records[0]);by_project=collections.defaultdict(list)
 for r in records:by_project[r['project_id']].append(r)
 report=[]
 for p in PLAN:
  assert db.query('SELECT slug FROM projects WHERE id=?',[p['id']])[0]['slug']==p['slug']
  project_rows=by_project[p['id']];previous=db.query('SELECT '+','.join(fields)+',deleted_at FROM leads WHERE project_id=? AND source_provider=?',[p['id'],PROVIDER]);prev={r['id']:r for r in previous}
  target='cloudflare' if hasattr(db,'cf') else 'local';backup=root/f'prepared/{p["key"]}/{target}-leads-before.json'
  if not backup.exists():save(backup,previous)
  inserted=[]
  if apply:
   now=datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
   db.query('INSERT INTO crm_projects(project_id,enabled_at,timezone,updated_at) VALUES(?,?,?,?) ON CONFLICT(project_id) DO NOTHING',[p['id'],now,'Asia/Tbilisi',now])
   pending=[]
   quote=lambda v:'NULL' if v is None else "'"+str(v).replace("'","''")+"'"
   def flush():
    if not pending:return
    sql=';\n'.join(pending)+';'
    if hasattr(db,'cf'):db.cf.query(sql)
    else:db.db.executescript('BEGIN IMMEDIATE;\n'+sql+'\nCOMMIT;')
    pending.clear()
   for r in project_rows:
    if r['id'] in prev:continue
    pending.append('INSERT OR IGNORE INTO leads('+','.join(fields)+') VALUES('+','.join(quote(r[k])for k in fields)+')');inserted.append(r)
    pending.append('INSERT OR IGNORE INTO crm_lead_state(lead_id,version,updated_at) VALUES('+quote(r['id'])+',0,'+quote(now)+')')
    # Record migration at its true time, without fabricated historical events or conversions.
    meta=json.loads(r['metadata_json']);note=json.dumps({'migration':True,'sourceStatus':meta['legacyStatus'],'historicalChangedAt':r['status_updated_at'],'note':meta.get('description','')},ensure_ascii=False)
    pending.append('INSERT OR IGNORE INTO lead_status_events(id,project_id,lead_id,to_status,changed_at,note) VALUES('+','.join(map(quote,['evt_restore_'+sha(r['id'])[:32],p['id'],r['id'],r['current_status'],r['status_updated_at'] or now,note]))+')')
    if len(pending)>=45:flush()
   flush()
   actual={r['id']:r for r in db.query('SELECT '+','.join(fields)+',deleted_at FROM leads WHERE project_id=? AND source_provider=?',[p['id'],PROVIDER])}
   assert all(all(actual[r['id']][k]==r[k] for k in fields) for r in inserted),'Inserted lead readback mismatch'
   assert all(actual[k]==v for k,v in prev.items()),'Existing user edits changed'
   assert all(r['id']in actual for r in project_rows)
   delivery=db.query("SELECT count(*) n FROM crm_delivery d JOIN leads l ON l.id=d.lead_id WHERE l.project_id=? AND l.source_provider=?",[p['id'],PROVIDER])[0]['n']
   assert not delivery,'Migration must not enqueue deliveries'
  else:
   immutable=['id','project_id','source_provider','external_lead_id','created_at','name','phone','email']
   assert all(r['id'] in prev and all(prev[r['id']][k]==r[k]for k in immutable)for r in project_rows),'Lead identity/readback mismatch'
  report.append({'project':p['key'],'leads':len(project_rows),'inserted':len(inserted),'preservedExisting':len(prev),'capiEventsCreated':0})
  print(json.dumps(report[-1]),flush=True)
 save(root/f'prepared/{target}-leads-result.json',report)
 return report

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('action',choices=['prepare','apply','verify']);ap.add_argument('root',type=Path);g=ap.add_mutually_exclusive_group();g.add_argument('--sqlite',type=Path);g.add_argument('--cloudflare',action='store_true');a=ap.parse_args();root=a.root.resolve();assert BASE.parent not in root.parents;os.umask(0o077)
 if a.action=='prepare':print(json.dumps(prepare(root),ensure_ascii=False));return
 spec=importlib.util.spec_from_file_location('history',BASE/'scripts/source-history.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
 if not(a.sqlite or a.cloudflare):ap.error('Choose target')
 transfer(root,mod.Cloudflare() if a.cloudflare else mod.SQLite(a.sqlite),a.action=='apply')
if __name__=='__main__':main()
