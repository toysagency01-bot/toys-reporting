#!/usr/bin/env python3
"""Copy approved Reviews Plus Meta sheet material into existing project pages.
Input is a private connector snapshot outside Git. Does not import ad facts.
Usage: python scripts/import-reviews-plus-materials.py SNAPSHOT_JSON [--apply]
"""
import hashlib,json,pathlib,runpy,sys
PROJECT='prj_reviews_plus'
TABS={'Еженедельная сводка (Meta)':('meta-weekly-source','table'), 'Месячная сводка (Meta)':('meta-monthly-source','table'),'Анализ конкурентов (Meta)':('meta-competitors','competitors'),'Креативный бриф (Meta)':('meta-creative-brief','creative-brief'),'Стратегия (Meta)':('meta-strategy','table')}
j=lambda value:json.dumps(value,ensure_ascii=False,separators=(',',':'))
def gviz(values,labels=None):
 width=max([len(r) for r in values]+[len(labels or [])]);return {'status':'ok','table':{'cols':[{'label':(labels or ['']*width)[i] if i<len(labels or []) else '', 'type':'string'} for i in range(width)],'rows':[{'c':[{'v':r[i] if i<len(r) else None} for i in range(width)]} for r in values]}}
def prepare(title,values):
 raw=gviz(values)
 if title=='Креативный бриф (Meta)' and len(values)>=4:
  labels=list(values[3]);labels[0]='Идея / Месседж';content=gviz(values[4:],labels)
 elif title=='Месячная сводка (Meta)' and len(values)>=2:
  # Generic tables read their header from the first row. Retain every source
  # row after a complete header, including the period and narrative notes.
  labels=values[1];content=gviz([labels,*values],labels)
 else:content=raw
 return content,raw
if __name__=='__main__':
 path=pathlib.Path(sys.argv[1]).resolve();assert not path.is_relative_to(pathlib.Path.cwd().parent.resolve()),'Private snapshot must remain outside Git'
 source=json.loads(path.read_text());assert {t['title'] for t in source}==set(TABS)|{'План работы (Meta)'}
 c=runpy.run_path('scripts/configure-client-access.py');api=c['api'];db=c['DB']
 def query(sql,params=[]):return api('/d1/database/'+db+'/query','POST',{'sql':sql,'params':params})[0]['results']
 updates=[];before=[]
 for tab in source:
  title=tab['title']
  if title not in TABS:continue
  key,mode=TABS[title];content,raw=prepare(title,tab['values']);contentJSON=j(content);rawJSON=j(raw);sha=hashlib.sha256(rawJSON.encode()).hexdigest()
  old=query('SELECT * FROM project_tabs WHERE project_id=? AND tab_key=?',[PROJECT,key]);assert len(old)==1
  before.append(old[0]);updates.append((key,mode,contentJSON,rawJSON,sha,old[0]['source_hash']))
 if '--apply' not in sys.argv:print(j({'preflight':True,'pages':len(updates),'sourceRows':{t['title']:len(t['values']) for t in source}}));sys.exit()
 backup=path.parent/'materials-before.json';assert not backup.exists(),'Prior receipt exists; reconcile before repeating';backup.write_text(j(before));backup.chmod(0o600)
 def q(v):return 'NULL' if v is None else "'"+str(v).replace("'","''")+"'"
 statements=[]
 for key,mode,content,raw,sha,oldHash in updates:
  statements.append('UPDATE project_tabs SET mode='+q(mode)+',content_json='+q(content)+',raw_content_json='+q(raw)+',source_hash='+q(sha)+",updated_at=datetime('now'),imported_at=datetime('now') WHERE project_id="+q(PROJECT)+' AND tab_key='+q(key)+' AND source_hash IS '+q(oldHash))
 result=api('/d1/database/'+db+'/query','POST',{'sql':';\n'.join(statements)});assert all(r['success'] and r['meta']['changes']==1 for r in result)
 verified=[]
 for key,mode,content,raw,sha,_ in updates:
  row=query('SELECT * FROM project_tabs WHERE project_id=? AND tab_key=?',[PROJECT,key])[0]
  assert row['content_json']==content and row['raw_content_json']==raw and row['source_hash']==sha and row['mode']==mode
  # Reconstruct each source cell from the stored raw payload and compare it.
  original=next(t['values'] for t in source if TABS.get(t['title'],(None,))[0]==key)
  stored=json.loads(row['raw_content_json'])['table']['rows'];assert len(stored)==len(original)
  for expected,actual in zip(original,stored):
   assert [cell['v'] for cell in actual['c'][:len(expected)]]==expected
   assert all(cell['v'] is None for cell in actual['c'][len(expected):])
  verified.append({'tab':key,'sourceRows':len(original)})
 assert query('SELECT COUNT(*) n FROM fact_observations WHERE project_id=?',[PROJECT])[0]['n']==0
 print(j({'verified':True,'pages':verified,'advertisingFacts':0}))
