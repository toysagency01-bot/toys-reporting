#!/usr/bin/env python3
"""Initialize the existing Reviews Plus project as a normal private dashboard.
No ad facts, account links, client grants or credentials are created.
Usage: python scripts/setup-reviews-plus.py prepare|apply|verify
"""
import datetime,hashlib,json,pathlib,runpy,sys
ORG='org_toys_agency';PROJECT='prj_reviews_plus';SLUG='reviews-plus'
STREAM='stream_reviews_plus_unconfigured';GEN='gen_reviews_plus_unconfigured_v1';RELEASE='release_reviews_plus_dashboard_v1';CONFIG='cfg_reviews_plus_dashboard_v1'
j=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':'))
def quote(v):return 'NULL' if v is None else str(v) if isinstance(v,int) else "'"+str(v).replace("'","''")+"'"
def statements():
 out=[]
 def insert(table,values):out.append('INSERT OR IGNORE INTO '+table+'('+','.join(values)+') VALUES('+','.join(quote(v) for v in values.values())+')')
 scope={'organization_id':ORG,'project_id':PROJECT}
 now=datetime.datetime.now(datetime.timezone.utc).isoformat()
 # A sealed empty generation explicitly represents an unconfigured source. UTC
 # is only its storage clock, not a claimed advertising-account timezone.
 manifest={'schemaVersion':'toys-data-release/1.0','datasets':[{'sourceStreamId':STREAM,'generationId':GEN,'grain':'campaign_daily','coverage':'unknown'}],'sourceState':'not_configured','synthetic':False}
 checksum=hashlib.sha256(j(manifest).encode()).hexdigest()
 insert('source_streams',dict(id=STREAM,**scope,channel_key='meta',delivery_provider='manual',business_provider='meta_ads',stable_source_ref='reviews-plus:unconfigured',source_timezone='UTC',grain='campaign_daily',source_schema_version='unconfigured/1',mapping_version='1'))
 insert('data_generations',dict(id=GEN,**scope,source_stream_id=STREAM,idempotency_key=GEN,source_hash=checksum,status='sealed',availability='not_configured',coverage='unknown',freshness='stale',requested_from='2026-10-27',requested_to_exclusive='2026-11-03',row_count=0,missing_ranges_json=j([{'from':'2026-10-27','toExclusive':'2026-11-03'}]),generated_at=now,sealed_at=now,details_json=j({'accountTimezoneKnown':False,'reason':'advertising_account_not_connected'})))
 insert('project_data_releases',dict(id=RELEASE,**scope,revision=1,status='sealed',manifest_json=j(manifest),source_hash=checksum))
 insert('project_data_release_pointers',dict(**scope,release_id=RELEASE,pointer_revision=1))
 config={'defaultView':'metrics','panels':['spend','impressions','clicks','ctr','reportedConversions','cpa'],'currencyPolicy':'native','contentNavigation':['meta']}
 insert('dashboard_config_revisions',dict(id=CONFIG,**scope,revision_number=1,schema_version='toys-dashboard-config/1.0',preset='leadgen',config_json=j(config),status='published'))
 insert('dashboard_config_pointers',dict(**scope,revision_id=CONFIG))
 for key,label in [('all','Все'),('meta','Meta')]:insert('project_channels',dict(**scope,channel_key=key,label=label))
 # Empty standard sections; never copy template advertising metrics or dates.
 for channel,key,title,mode,headers,pos in [
  ('meta','weekly-source','Еженедельная сводка (Meta)','table',['Период','Расход','Показы','Клики','Лиды','Комментарий'],1),
  ('meta','monthly-source','Месячная сводка (Meta)','table',['Месяц','Расход','Показы','Клики','Лиды','Комментарий'],2),
  ('meta','competitors','Анализ конкурентов (Meta)','competitors',['Конкурент','Сайт','Реклама','Выводы'],3),
  ('meta','creative-brief','Креативный бриф (Meta)','table',['Формат','Оффер','Текст','Материалы','Статус'],4),
  ('meta','strategy','Стратегия (Meta)','table',['Раздел','Описание'],5),
]:
  table={'status':'ok','table':{'cols':[{'label':h,'type':'string'} for h in headers],'rows':[]}}
  insert('project_tabs',dict(id='tab_reviews_plus_'+channel+'_'+key,project_id=PROJECT,channel=channel,tab_key=channel+'-'+key,source_title=title,label=title.rsplit(' (',1)[0],mode=mode,position=pos,content_json=j(table),raw_content_json=j(table),source_hash=hashlib.sha256(j(table).encode()).hexdigest()))
 out.append("UPDATE projects SET status='active',project_type='leadgen',settings_json=json_remove(settings_json,'$.onboarding'),updated_at=datetime('now') WHERE id="+quote(PROJECT)+" AND slug="+quote(SLUG))
 return out
if __name__=='__main__':
 action=sys.argv[1] if len(sys.argv)>1 else ''
 if action=='prepare':
  path=pathlib.Path('dist/reviews-plus-dashboard.sql');path.write_text(';\n'.join(statements())+';\n');print(j({'prepared':str(path)}));sys.exit()
 c=runpy.run_path('scripts/configure-client-access.py')
 def query(sql,params=[]):return c['api']('/d1/database/'+c['DB']+'/query','POST',{'sql':sql,'params':params})[0]['results']
 p=query('SELECT * FROM projects WHERE id=? AND slug=?',[PROJECT,SLUG]);assert len(p)==1
 pointers=query('SELECT release_id FROM project_data_release_pointers WHERE project_id=?',[PROJECT]);assert not pointers or pointers[0]['release_id']==RELEASE,'Preserve another active release'
 if action=='apply':
  assert p[0]['project_type']=='leadgen'
  result=c['api']('/d1/database/'+c['DB']+'/query','POST',{'sql':';\n'.join(statements())})
  assert all(r['success'] for r in result)
 elif action!='verify':raise SystemExit(__doc__)
 current=query('SELECT status,json_extract(settings_json,\'$.onboarding\') AS onboarding FROM projects WHERE id=?',[PROJECT])[0]
 tabs=query('SELECT tab_key FROM project_tabs WHERE project_id=?',[PROJECT])
 gen=query('SELECT availability,row_count FROM data_generations WHERE id=?',[GEN])[0]
 assert current['status']=='active' and current['onboarding'] is None
 assert len(tabs)==6 and gen['availability']=='not_configured' and gen['row_count']==0
 assert query('SELECT count(*) n FROM fact_observations WHERE project_id=?',[PROJECT])[0]['n']==0
 print(j({'verified':True,'project':SLUG,'status':'active','tabs':len(tabs),'adSource':'not_configured','adFacts':0}))
