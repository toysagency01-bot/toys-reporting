#!/usr/bin/env python3
"""Import only the reviewed synthetic NOVA dataset into the current platform D1.

The project stays draft until the administrator-only Worker is deployed. Reruns
are insert-only/idempotent; no existing client row or membership is updated.
"""
import argparse,importlib.util,json,pathlib,re,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
PROJECT='prj_nova_sales_demo'

def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
 generator=load('sales_demo_builder',ROOT/'scripts/build-sales-demo.py');sql,manifest=generator.build();generator.verify(sql,manifest)
 allowed={'clients','projects','project_channels','dashboard_config_revisions','dashboard_config_pointers','crm_projects','source_streams','data_generations','fact_observations','fact_values','ad_metrics_daily','project_data_releases','project_data_release_pointers','leads','crm_lead_state','lead_status_events','crm_milestones','sales','lead_comments','content_items','content_revisions','content_blocks','project_tabs'}
 statements=[]
 for line in sql.splitlines():
  if not line.startswith('INSERT OR IGNORE INTO '):continue
  table=re.match(r'INSERT OR IGNORE INTO (\w+) ',line)[1]
  assert table in allowed and ('nova_demo' in line or 'nova_sales_demo' in line)
  if table=='projects':line=line.replace("'Asia/Tbilisi','active'","'Asia/Tbilisi','draft'")
  statements.append(line)
 assert len(statements)>9000
 if not args.apply:print(json.dumps({'validated':True,'statements':len(statements),'totals':manifest['totals'],'apply':False}));return
 cf=load('sales_demo_cloudflare',ROOT/'scripts/configure-client-access.py')
 query=lambda sql:cf.query(sql)[0]['results']
 for row in query("SELECT id,slug,organization_id,settings_json FROM projects WHERE id='prj_nova_sales_demo' OR slug='nova-sales-demo'"):
  settings=json.loads(row['settings_json']);assert row['id']==PROJECT and row['slug']=='nova-sales-demo' and row['organization_id']=='org_toys_agency' and settings.get('synthetic') is True and settings.get('containsRealClientData') is False,'Existing project identity collision'
 for row in query("SELECT slug,name FROM clients WHERE id='client_nova_sales_demo'"):
  assert row['slug']=='nova-sales-demo' and row['name']=='NOVA Business Services · DEMO','Existing client identity collision'
 chunks=[];chunk=[];size=0
 for line in statements:
  if chunk and (len(chunk)>=150 or size+len(line.encode())>90000):chunks.append(chunk);chunk=[];size=0
  chunk.append(line);size+=len(line.encode())
 if chunk:chunks.append(chunk)
 for i,chunk in enumerate(chunks):
  results=cf.query('\n'.join(chunk));assert all(r.get('success') for r in results)
  if (i+1)%10==0 or i+1==len(chunks):print(json.dumps({'importedBatches':i+1,'totalBatches':len(chunks)}),flush=True)
 checks=query("""SELECT (SELECT COUNT(*) FROM leads WHERE project_id='prj_nova_sales_demo') AS leads,
 (SELECT COUNT(*) FROM crm_milestones WHERE project_id='prj_nova_sales_demo' AND kind='qualified') AS qualified,
 (SELECT COUNT(*) FROM crm_milestones WHERE project_id='prj_nova_sales_demo' AND kind='sale') AS sales,
 (SELECT ROUND(SUM(CAST(value AS REAL)),2) FROM crm_milestones WHERE project_id='prj_nova_sales_demo' AND kind='sale') AS revenue,
 (SELECT ROUND(SUM(spend),2) FROM ad_metrics_daily WHERE project_id='prj_nova_sales_demo') AS spend,
 (SELECT COUNT(*) FROM ad_metrics_daily WHERE project_id='prj_nova_sales_demo') AS observations,
 (SELECT COUNT(*) FROM content_items WHERE project_id='prj_nova_sales_demo') AS reports,
 (SELECT COUNT(*) FROM project_tabs WHERE project_id='prj_nova_sales_demo') AS projectTabs,
 (SELECT COUNT(*) FROM integrations WHERE project_id='prj_nova_sales_demo') AS integrations,
 (SELECT COUNT(*) FROM crm_delivery WHERE project_id='prj_nova_sales_demo') AS deliveries,
 (SELECT COUNT(*) FROM project_memberships WHERE project_id='prj_nova_sales_demo') AS memberships,
 (SELECT capi_enabled FROM crm_projects WHERE project_id='prj_nova_sales_demo') AS capiEnabled""")[0]
 for name in ['leads','qualified','sales','revenue','spend']:assert checks[name]==manifest['totals'][name],(name,checks[name])
 for name,expected in [('observations',400),('reports',6),('projectTabs',8),('integrations',0),('deliveries',0),('memberships',0),('capiEnabled',0)]:assert checks[name]==expected,(name,checks[name])
 (ROOT/'dist/sales-demo/hosted-validation.json').write_text(json.dumps(checks,indent=2)+'\n')
 print(json.dumps({'validated':checks,'activation':'draft; deploy administrator-only access before activation'}))
if __name__=='__main__':main()
