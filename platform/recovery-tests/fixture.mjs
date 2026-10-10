import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {buildImportSql} from '../scripts/build-housevip-mvp-import.mjs';

export async function testWorker(){
  await build({entryPoints:['unified/worker.js'],outfile:'dist/test-worker.mjs',bundle:true,platform:'node',format:'esm',loader:{'.html':'text','.css':'text','.txt':'text'},plugins:[{name:'test-cloudflare-entrypoint',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cloudflare:workers',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export class WorkerEntrypoint { constructor(ctx,env){ this.ctx=ctx;this.env=env; } }'}));}}]});
  return (await import('../dist/test-worker.mjs')).default;
}
export function fixture(){
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../recovered/schema.sql',import.meta.url),'utf8'));
  db.exec(`INSERT INTO organizations(id,slug,name) VALUES('org_toys_agency','toys-agency','Synthetic test');
INSERT INTO clients(id,organization_id,slug,name) VALUES('client_housevip','org_toys_agency','housevip','Synthetic test');
INSERT INTO projects(id,organization_id,slug,name,project_type,status,currency,client_id,capabilities_json,active_preset) VALUES('prj_housevip_cxp7','org_toys_agency','housevip-cxp7','HOUSEVIP','leadgen','active','IDR','client_housevip','["ads","content","period_reports"]','leadgen');
INSERT INTO project_channels(organization_id,project_id,channel_key,label) VALUES('org_toys_agency','prj_housevip_cxp7','all','Все'),('org_toys_agency','prj_housevip_cxp7','meta','Meta');`);
  db.exec('INSERT INTO dashboard_config_revisions\n  (id, organization_id, project_id, revision_number, schema_version, preset, config_json, status)\nVALUES\n  (\'cfg_housevip_1\', \'org_toys_agency\', \'prj_housevip_cxp7\', 1, \'toys-dashboard-config/1.0\', \'leadgen\',\n   \'{"defaultView":"metrics","panels":["spend","impressions","clicks","ctr","reportedConversions","cpa"],"currencyPolicy":"native","contentNavigation":["meta","smm"]}\',\n   \'published\');\n\nINSERT INTO dashboard_config_pointers (organization_id, project_id, revision_id)\nVALUES (\'org_toys_agency\', \'prj_housevip_cxp7\', \'cfg_housevip_1\');\n');
  const snapshot={schema_version:'housevip-pilot-snapshot/1.0',generated_at:'2026-10-09T09:16:57.902Z',project:'HOUSEVIP',requested_window:{start:'2026-09-10',end:'2026-10-09',timezone:'Asia/Tbilisi'},privacy:{includes_personal_lead_or_contact_rows:false,includes_secrets:false},ad_rows:[{date:'2026-10-07',platform:'Meta Ads',currency:'IDR',campaign:'Тестовая кампания',impressions:1000,clicks:25,cost:420000,conversions:4,conv_value:0,source_tab:'MetaAds',source_row:2}],aggregates:{control_totals_by_currency:[{currency:'IDR',impressions:1000,clicks:25,cost:420000,conversions:4,conv_value:0}]},coverage:{observed_min:'2026-10-07',observed_max:'2026-10-07',available_rows:1,missing_days_are_not_zero:true}};
  db.exec(buildImportSql(snapshot).sql);
  // Fixtures only. They are never sent to Cloudflare or committed as real project data.
  db.prepare(`INSERT INTO project_tabs(project_id,tab_key,source_title,label,channel,mode,position,content_json) VALUES(?,?,?,?,?,?,?,?)`).run('prj_housevip_cxp7','test-plan','План работ (Meta)','План работ','meta','plan',1,JSON.stringify({status:'ok',table:{cols:['Этап','Задача','Дедлайн','Ответственный','Статус','','Комментарий'].map(label=>({label})),rows:[{c:['Креативы','Подготовить новые креативы','2026-10-15','Agency','В работе','',''].map(v=>({v}))}]}}));
  class Statement{constructor(sql){this.s=db.prepare(sql);this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.s.get(...this.args)||null;}async all(){return{results:this.s.all(...this.args)};}async run(){const r=this.s.run(...this.args);return{success:true,meta:{changes:Number(r.changes)}};}}
  const d1={prepare:sql=>new Statement(sql),async batch(statements){db.exec('BEGIN IMMEDIATE');try{const out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};
  return {db,env:{TOYS_DB:d1,ENVIRONMENT:'test',MVP_EDITOR_TOKEN:'synthetic-local-editor-token',MVP_VIEW_TOKEN:'synthetic-local-viewer-token',MVP_VIEW_PROJECTS:'housevip-cxp7',MVP_EDITOR_PROJECTS:'housevip-cxp7',MVP_PUBLIC_PROJECT_MATERIALS:'housevip-cxp7',MVP_PUBLIC_VIEW_PROJECTS:'housevip-cxp7',ASSETS:{fetch:async()=>new Response('unchanged legacy asset')},MVP_AS_OF_DATE:'2026-10-10'}};
}
export function request(path,{method='GET',body,role='editor',key='synthetic-request-key'}={}){return new Request('https://test.local'+path,{method,headers:{...(role?{authorization:`Bearer synthetic-local-${role}-token`}:{}),'content-type':'application/json','x-idempotency-key':key},...(body?{body:JSON.stringify(body)}:{})});}
