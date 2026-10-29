import {seedProductFunnel} from './product-funnel-fixture.mjs';
import {seedCompetitorAnalysis} from './competitor-analysis-fixture.mjs';
import {seedReviewsPlus} from './reviews-plus-fixture.mjs';
import {seedMonthly} from './monthly-fixture.mjs';
import {seedOnboarding} from './onboarding-fixture.mjs';
import {readFileSync} from 'node:fs';
import {roleBrowserFixture} from './roles-browser-fixture.mjs';
import pages from '../pages-hotfix/_worker.js';
import http from 'node:http';
import {fixture,testWorker} from './fixture.mjs';
const worker=await testWorker();const{env,db}=fixture();env.MVP_EDITOR_PROJECTS+=',__master,profkit-instashop-r4vk,karlovarska-sul-k4rm,bs-clinic-a5b4,toys-agency-ctft';env.MVP_VIEW_PROJECTS=env.MVP_EDITOR_PROJECTS;
if(process.env.TOYS_TEST_COHORT==='true'){
 db.exec("INSERT INTO crm_projects(project_id,enabled_at,timezone,updated_at) VALUES('prj_housevip_cxp7','2026-01-01T00:00:00Z','Asia/Tbilisi','2026-10-14T06:00:00Z'); INSERT INTO leads(id,project_id,source_provider,external_lead_id,created_at,name,current_status,metadata_json) VALUES('cohort-browser','prj_housevip_cxp7','manual','cohort-browser','2026-10-07T09:00:00Z','Synthetic cohort','Квалифицирован','{}'); INSERT INTO crm_milestones(id,project_id,lead_id,kind,occurred_at) VALUES('cohort-milestone','prj_housevip_cxp7','cohort-browser','qualified','2026-10-14T06:00:00Z');");
}
if(process.env.TOYS_TEST_EMPTY_WEEKLY==='true')db.exec("UPDATE content_items SET logical_key='legacy-weekly' WHERE logical_key='weekly-main'");
if(process.env.TOYS_TEST_CRM_INDUSTRY==='real_estate')db.exec("UPDATE projects SET settings_json=json_set(settings_json,'$.industry','real_estate') WHERE id='prj_housevip_cxp7'");
if(process.env.TOYS_TEST_CRM_TEMPLATE==='toys_agency')db.exec("UPDATE projects SET settings_json=json_set(settings_json,'$.crmTemplate','toys_agency') WHERE id='prj_housevip_cxp7'");
if(process.env.TOYS_TEST_REPORT_STORAGE==='true'){const files=new Map();env.REPORT_ATTACHMENTS={put:async(k,v)=>files.set(k,v),get:async k=>files.has(k)?{body:files.get(k)}:null};}
if(process.env.TOYS_TEST_SALES_DEMO==='true')db.exec(readFileSync('dist/sales-demo/import.sql','utf8'));
if(process.env.TOYS_TEST_MONTHLY==='true'){seedMonthly(db);if(process.env.TOYS_TEST_MONTHLY_SOURCE==='true'){db.exec('DELETE FROM project_monthly_reports');db.exec(readFileSync('dist/bsclinic-monthly/import.sql','utf8'));}}
if(process.env.TOYS_TEST_PROJECT_MANAGEMENT==='true'){env.CRM_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');env.META_ADS_ACCESS_TOKEN='synthetic-setup-token';env.PROJECT_SETUP_FETCH=async url=>{if(url.includes('graph.facebook.com'))return Response.json({account_id:'123456789',name:'Synthetic browser account',currency:'EUR',timezone_name:'UTC'});if(url.includes('/cards?'))return Response.json({current_page:1,last_page:1,total:0,data:[]});if(url.includes('/statuses?'))return Response.json({last_page:1,data:[{id:2,title:'Qualified'}]});return Response.json({last_page:1,data:[{id:1,title:'Synthetic pipeline'}]});};}
if(process.env.TOYS_TEST_PROJECT_DESIGN==='true'){const registry=JSON.parse(readFileSync('projects.json','utf8'));env.MVP_EDITOR_PROJECTS=Object.keys(registry).join(',')+',__master';env.MVP_VIEW_PROJECTS=env.MVP_EDITOR_PROJECTS;}
const roleTokens=process.env.TOYS_TEST_PLATFORM_ROLES==='true'?roleBrowserFixture(env,db):null;
if(process.env.TOYS_TEST_PRODUCT_FUNNEL==='true')await seedProductFunnel(env,db);
if(process.env.TOYS_TEST_ONBOARDING==='true')await seedOnboarding(env,db);
if(process.env.TOYS_TEST_REVIEWS_PLUS==='true')seedReviewsPlus(env,db);
if(process.env.TOYS_TEST_COMPETITOR_ANALYSIS==='true')seedCompetitorAnalysis(db);
if(process.env.TOYS_TEST_MONTHLY==='true'&&roleTokens){for(const [id,role]of [['team','buyer'],['client','client_manager']])db.prepare('INSERT INTO project_memberships(project_id,user_id,role) VALUES(?,?,?)').run('prj_bs_clinic_a5b4','role-'+id,role);}
if(process.env.TOYS_TEST_ADMIN_CRM==='true')db.prepare("INSERT INTO crm_projects(project_id,enabled_at,timezone,updated_at,access_mode) VALUES('prj_housevip_cxp7',?,'Asia/Tbilisi',?,'admin')").run(new Date().toISOString(),new Date().toISOString());
http.createServer(async(req,res)=>{try{if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const publicMode=req.headers['x-test-public']==='true';const headers={...req.headers,...(!publicMode?{authorization:req.headers['x-test-viewer']==='true'?'Bearer synthetic-local-viewer-token':'Bearer synthetic-local-editor-token'}:{})};if(roleTokens){const role=req.headers['x-test-role']||'admin';headers.cookie='__Host-toys_session='+roleTokens[role];}const requestEnv=publicMode?{...env,ENVIRONMENT:'staging'}:env;const incoming=new Request('http://127.0.0.1:4173'+req.url,{method:req.method,headers,...(body.length?{body}: {})});const binding={fetch:request=>new URL(request.url).pathname.startsWith('/api/')?worker.fetch(request,requestEnv):Promise.resolve(new Response('OLD STATIC BOARD'))};const r=await pages.fetch(incoming,{STAGING_MVP:binding,PRODUCTION_API:binding});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch(e){console.error(e);res.writeHead(500);res.end('Test server error');}}).listen(4173,'127.0.0.1');
