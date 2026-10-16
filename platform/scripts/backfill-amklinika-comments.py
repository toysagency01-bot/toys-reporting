#!/usr/bin/env python3
"""Reconcile captured AM Klinika feedback and form descriptions without CAPI replay.

Input is a private directory containing bounded connector captures and D1 backups.
Plan first; apply uses exact source IDs, metadata compare-and-swap, and readback.
No source sheets are modified. Contact data must never be committed.
"""
import argparse, hashlib, importlib.util, json
from datetime import datetime, timezone
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
PROJECT='prj_amklinika_k8m2'
BOOK='1CUG7bljcemLqnKNq0nv4tpKtNGH4GDIbeQB2fDH5sSM'
CLIENT_BOOK='18iWuDrT142PvJOcxS7SPfZJOVZEwfB4QjoKdf8Gy9XU'
SHEETS={'Lead Site':258218750,'Lead_meta_new':386002818,'Lead_meta_ru':1039108541,'Lead_meta_ru_mechanic':1949705827,'Lead_meta_cz_mechanic':1027581730}
spec=importlib.util.spec_from_file_location('legacy',BASE/'scripts/restore-rollout-leads.py');legacy=importlib.util.module_from_spec(spec);spec.loader.exec_module(legacy)
def sha(value):return hashlib.sha256(value.encode()).hexdigest()
def dump(value):return json.dumps(value,ensure_ascii=False,separators=(',',':'))
def save(path,value):path.write_text(dump(value));path.chmod(0o600)
def load(root,name):return json.loads((root/name).read_text())
def feedback_id(title,row):return sha(title+'\x1f'+'\x1f'.join((row+['']*8)[:8]))[:24]
def note_text(event):
 try:return json.loads(event['note']).get('note','')
 except (ValueError,AttributeError):return event['note'] or ''
def build_plan(root,leads,events,now):
 assert all(l['project_id']==PROJECT for l in leads)
 sources={};by_lead={l['id']:l for l in leads};feedback=load(root,'source-LeadFeedback.json')['values'][1:]
 def add_sources(filename,title,book,tab):
  for n,raw in enumerate(load(root,filename)['values'],1):
   row=[str(v) if v is not None else '' for v in raw]+['']*20
   meta=title!='Lead Site'
   if meta and not row[0].startswith('l:') or not meta and n==1:continue
   source_key=row[0] if meta else feedback_id(title,row)
   item={'book':book,'sheet':tab,'sourceSheet':title,'row':n,'values':row,'key':source_key}
   sources.setdefault((title,source_key),[]).append(item)
 for title in SHEETS:add_sources('source-'+title.replace(' ','_')+'.json',title,BOOK,title)
 add_sources('client-Lead.json','Lead Site',CLIENT_BOOK,'Lead')
 for title in ['Lead_meta_new','Lead_meta_ru']:add_sources('client-'+title+'.json',title,CLIENT_BOOK,title)
 feedback_matches={};updates={};new=[];added_events=[];unmatched=[];already=0
 def source_for(title,key):
  candidates=sources.get((title,key),[])
  # Prefer the project capture; recover a valid timestamp from the original
  # client workbook only when the project row has lost it (e.g. date = 0).
  candidates=[s for s in candidates if legacy.timestamp(s['values'][1 if title!='Lead Site' else 0],'Europe/Bucharest')]
  if not candidates:return None
  signature=lambda s: (s['values'][13:16] if title!='Lead Site' else s['values'][1:4])
  assert all(signature(s)==signature(candidates[0]) for s in candidates),'Conflicting source contact'
  return candidates[0]
 for number,raw in enumerate(feedback,2):
  f=[str(v) if v is not None else ''for v in raw]+['']*10
  if not f[2].strip():continue
  title=f[5];key=f[6] if title!='Lead Site' else f[0]
  matches=[]
  for lead in leads:
   m=json.loads(lead['metadata_json']);old=m.get('legacyFeedback')
   if old and old[0]==f[0] or title!='Lead Site' and key and m.get('leadgenId')==key.removeprefix('l:'):matches.append(lead)
  if len(matches)>1:raise ValueError('Ambiguous CRM identity')
  source=source_for(title,key)
  if matches:lead=matches[0]
  elif source:
   r=source['values'];meta=title!='Lead Site';external=key.removeprefix('l:') if meta else 'feedback:'+f[0]
   identity=sha(external)[:24];lead_id='lead_amklinika_'+identity
   if lead_id in by_lead:raise ValueError('Unexpected existing identity')
   date=legacy.timestamp(r[1 if meta else 0],'Europe/Bucharest');changed=legacy.timestamp(f[4] or f[3],'Europe/Bucharest')
   info={'migration':'amklinika-comments-v1','sourceWorkbook':source['book'],'sourceSheet':title,'sourceRows':[{'sheet':source['sheet'],'row':source['row']}],'sourceDate':r[1 if meta else 0],'legacyStatus':f[1],'legacyFeedback':f[:9],'description':f[2],'leadgenId':external if meta else None}
   if meta:info.update(sourceAdId=r[2].removeprefix('ag:'),formId=r[8].removeprefix('f:'),adAttribution={'version':1,'provider':'meta_ads','accountId':'1830858661278666','adId':r[2].removeprefix('ag:'),'adsetId':r[4].removeprefix('as:'),'campaignId':r[6].removeprefix('c:')})
   lead={'id':lead_id,'project_id':PROJECT,'source_provider':'legacy_project_sheet','external_lead_id':external,'created_at':date,'name':r[13] if meta else ' '.join(filter(None,r[1:3])),'phone':r[14].removeprefix('p:') if meta else r[3],'email':r[15] if meta else '', 'current_status':legacy.mapped_status('amklinika',f[1]),'status_updated_at':changed,'metadata_json':dump(info)}
   assert lead['name'] and lead['phone'] and date
   new.append(lead);by_lead[lead_id]=lead
  else:unmatched.append({'feedbackRow':number,'feedbackId':f[0],'reason':'source_contact_missing'});continue
  if lead.get('deleted_at'):unmatched.append({'feedbackRow':number,'feedbackId':f[0],'reason':'deleted_lead_preserved'});continue
  feedback_matches[f[0]]=lead['id']
  if any(e['lead_id']==lead['id'] and note_text(e)==f[2] for e in events):already+=1;continue
  event_id='evt_amk_comment_'+sha(lead['id']+'\x1f'+f[0]+'\x1f'+f[2])[:32]
  added_events.append({'id':event_id,'project_id':PROJECT,'lead_id':lead['id'],'from_status':lead['current_status'],'to_status':lead['current_status'],'changed_at':legacy.timestamp(f[3],'Europe/Bucharest')or now,'note':dump({'kind':'imported_comment','migration':True,'note':f[2],'sourceWorkbook':BOOK,'sourceSheet':'LeadFeedback','sourceRow':number,'feedbackId':f[0],'sourceUpdatedAt':f[3],'importedAt':now})})
 # Attach original form text to all existing and recovered contacts, separately
 # from their feedback/CRM notes. Never overwrite either.
 requests=0
 for lead in [*leads,*new]:
  if lead.get('deleted_at'):continue
  m=json.loads(lead['metadata_json']);title=m.get('sourceSheet');old=m.get('legacyFeedback');key='l:'+str(m['leadgenId']) if m.get('leadgenId') else old[0] if old else None
  source=source_for(title,key) if key else None
  if not source:continue
  r=source['values'];text=r[12] if title!='Lead Site' else r[5];service='' if title!='Lead Site' else r[4]
  if not text.strip() and not service.strip():continue
  request={'text':text,'service':service,'sourceWorkbook':source['book'],'sourceSheet':source['sheet'],'sourceRow':source['row']}
  if m.get('sourceRequest')==request:continue
  if m.get('sourceRequest'):raise ValueError('Existing request must be reviewed, not overwritten')
  before=lead['metadata_json'];m['sourceRequest']=request;after=dump(m);requests+=1
  if lead in new:lead['metadata_json']=after
  else:updates[lead['id']]={'id':lead['id'],'before':before,'after':after}
 return {'project':PROJECT,'createdAt':now,'updates':list(updates.values()),'newLeads':new,'events':added_events,'unmatched':unmatched,'summary':{'existingLeads':len(leads),'matchedFeedback':len(feedback_matches),'commentsAlreadyPresent':already,'commentsAdded':len(added_events),'leadsRecovered':len(new),'sourceRequestsAdded':requests,'unmatchedComments':len(unmatched)}}
def statements(plan):
 q=lambda v:'NULL' if v is None else "'"+str(v).replace("'","''")+"'"
 out=[]
 for row in plan['newLeads']:
  out.append('INSERT OR IGNORE INTO leads('+','.join(row)+') VALUES('+','.join(q(v)for v in row.values())+')')
  out.append('INSERT OR IGNORE INTO crm_lead_state(lead_id,version,updated_at) VALUES('+q(row['id'])+',0,'+q(plan['createdAt'])+')')
 for u in plan['updates']:
  out.append('UPDATE leads SET metadata_json='+q(u['after'])+' WHERE id='+q(u['id'])+' AND project_id='+q(PROJECT)+' AND deleted_at IS NULL AND metadata_json='+q(u['before']))
 for row in plan['events']:
  out.append('INSERT OR IGNORE INTO lead_status_events('+','.join(row)+') SELECT '+','.join(q(v)for v in row.values())+' WHERE EXISTS(SELECT 1 FROM leads WHERE id='+q(row['lead_id'])+' AND project_id='+q(PROJECT)+' AND deleted_at IS NULL)')
 return out
if __name__=='__main__':
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('root',type=Path);args=ap.parse_args();root=args.root
 plan=build_plan(root,load(root,'leads-before.json'),load(root,'events-before.json'),datetime.now(timezone.utc).isoformat().replace('+00:00','Z'))
 save(root/'plan.json',plan);(root/'apply.sql').write_text(';\n'.join(statements(plan))+';\n');(root/'apply.sql').chmod(0o600)
 print(dump(plan['summary']))
