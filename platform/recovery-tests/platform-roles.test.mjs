import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {fixture,testWorker} from './fixture.mjs';
const worker=await testWorker(),base='/api/v2/projects/housevip-cxp7';
const digest=s=>createHash('sha256').update(s).digest('hex');
function setup(){
 const f=fixture();Object.assign(f.env,{ENVIRONMENT:'staging',PASSWORD_AUTH_ENABLED:'true',MVP_PUBLIC_VIEW_PROJECTS:'housevip-cxp7,amklinika-k8m2',MVP_PUBLIC_PROJECT_MATERIALS:'housevip-cxp7,amklinika-k8m2'});
 f.db.exec("INSERT INTO projects(id,organization_id,slug,name,project_type,status,currency,client_id,capabilities_json,active_preset) VALUES('p2','org_toys_agency','amklinika-k8m2','Private clinic','leadgen','active','EUR','client_housevip','[]','leadgen')");
 const add=(id,role,slugs=[])=>{const token=randomBytes(32).toString('hex');f.db.prepare("INSERT INTO users(id,email,status) VALUES(?,?,'active')").run(id,id+'@example.test');f.db.prepare('INSERT INTO platform_user_roles(user_id,role) VALUES(?,?)').run(id,role);f.db.prepare("INSERT INTO portal_credentials(user_id,password_hash,updated_at) VALUES(?,'unused',datetime('now'))").run(id);f.db.prepare('INSERT INTO portal_sessions(token_hash,user_id,credential_version,expires_at,created_at) VALUES(?,?,1,?,?)').run(digest(token),id,Math.floor(Date.now()/1000)+3600,Math.floor(Date.now()/1000));for(const slug of slugs)f.db.prepare('INSERT INTO project_memberships(project_id,user_id,role) SELECT id,?,? FROM projects WHERE slug=?').run(id,role==='team'?'buyer':'client_manager',slug);return token;};
 const tokens={admin:add('admin','admin'),team:add('team','team',['housevip-cxp7']),empty:add('empty','team'),client:add('client','client',['housevip-cxp7']),shared:add('shared','client',['housevip-cxp7','amklinika-k8m2']),other:add('other','client',['amklinika-k8m2'])};
 const call=(who,path,body,method=body?'POST':'GET',key=crypto.randomUUID())=>worker.fetch(new Request('https://test.local'+path,{method,headers:{cookie:'__Host-toys_session='+tokens[who],origin:'https://test.local','content-type':'application/json','x-idempotency-key':key},...(body?{body:JSON.stringify(body)}:{})}),f.env);
 return {...f,call,tokens};
}
test('team master, reports and CRM are limited to assigned projects; clients cannot enter master',async()=>{
 const {db,call}=setup();try{
  const result=await(await call('team','/api/v2/master')).json();assert.deepEqual(result.projects.map(p=>p.slug),['housevip-cxp7']);assert.equal(result.access.role,'team');assert.deepEqual(result.pages,[]);assert.deepEqual(result.channels,[]);
  assert.equal((await call('team','/master/')).status,200);
  assert.equal((await call('team','/api/v2/portal/session')).headers.get('location'),'/master/');
  const empty=await(await call('empty','/api/v2/master')).json();assert.deepEqual(empty.projects,[]);assert.equal((await call('empty','/master/')).status,200);
  assert.equal((await call('client','/api/v2/master')).status,403);assert.equal((await call('client',base+'/crm')).status,200);
  for(const path of ['/amklinika-k8m2/','/api/v2/master/projects/amklinika-k8m2/summary?from=2026-10-01&to=2026-10-16',...['dashboard','crm','weekly-reports','content/tabs','content?logicalKey=weekly-main','content/weekly-main/attachments/unknown'].map(p=>'/api/v2/projects/amklinika-k8m2/'+p)])assert.equal((await call('team',path)).status,403,path);
  for(const path of [base+'/crm/connections','/api/v2/master/discover-pages'])assert.equal((await call('team',path,path.endsWith('pages')?{}:null)).status,403);
  assert.equal((await call('admin',base+'/crm/connections')).status,200);
  assert.equal((await call('admin','/api/v2/master/daily-review/telegram')).status,200);
  for(const who of ['team','empty','client'])assert.equal((await call(who,'/api/v2/master/daily-review/telegram')).status,403);
  const lead=await(await call('team',base+'/crm',{name:'Team lead',phone:'+12345',source:'manual'})).json();assert.ok(lead.lead?.id);
  const listed=await(await call('team',base+'/crm')).json(),leadVersion=listed.leads.find(l=>l.id===lead.lead.id).version;
  const update=await call('team',base+'/crm/leads/'+lead.lead.id,{status:'В работе',version:leadVersion},'PATCH');assert.equal(update.status,200,await update.text());
  const h=await(await call('team',base+'/content/weekly-main/revisions')).json();assert.equal(h.canDelete,true);
  const body={id:h.item.id,expectedRevision:h.item.latestRevision,expectedPublishedRevisionId:h.item.publishedRevisionId};
  assert.equal((await call('client',base+'/content/weekly-main/delete',body)).status,403);
  assert.equal((await call('team',base+'/content/weekly-main/delete',body)).status,200);
  assert.equal((await call('team',base+'/content/weekly-main/initialize',{})).status,200);
  const report={expectedRevision:0,expectedPublishedRevisionId:null,blocks:[{blockKey:'summary',type:'period_summary',payload:{periodStart:'2026-10-10',periodEnd:'2026-10-16',channel:'meta',summary:'Team publication'}}]};
  const saved=await call('team',base+'/content/weekly-main/save-and-publish',report);assert.equal(saved.status,201,await saved.text());
 }finally{db.close();}
});
test('only admins assign team roles; team client grants preserve other projects and cannot reset shared accounts',async()=>{
 const {db,call}=setup();try{
  const path='/api/v2/master/access',body={name:'New',email:'new@example.test',role:'client',enabled:true,version:0,projects:['housevip-cxp7']};
  for(const role of ['admin','team'])assert.equal((await call('team',path,{...body,role})).status,403);
  assert.equal((await call('team',path,{...body,projects:['amklinika-k8m2']})).status,403);
  const created=await(await call('team',path,body,'POST','team-create')).json();assert.equal(created.ok,true);
  assert.equal((await call('team',path,body,'POST','team-create')).status,200);
  assert.equal((await call('admin',path,body,'POST','team-create')).status,409);
  assert.equal((await call('team',path+'/invite',{userId:created.id})).status,200);
  for(const userId of ['admin','team','shared','other'])assert.equal((await call('team',path+'/invite',{userId})).status,403);
  const list=await(await call('team',path)).json();assert.equal(list.canManageTeam,false);assert.equal(list.users.some(u=>['admin','team','other'].includes(u.id)),false);assert.deepEqual(list.projects.map(p=>p.slug),['housevip-cxp7']);assert.deepEqual(list.users.find(u=>u.id==='shared').projects.map(p=>p.slug),['housevip-cxp7']);assert.equal(list.users.find(u=>u.id==='shared').canInvite,false);
  const shared={...body,email:'shared@example.test',projects:[]};assert.equal((await call('team',path,shared)).status,200);
  assert.deepEqual(db.prepare("SELECT project_id FROM project_memberships WHERE user_id='shared'").all().map(r=>r.project_id),['p2']);
  assert.equal((await call('team',path,{...body,email:'other@example.test'})).status,403);
  assert.equal((await call('team',path,{...body,email:'client@example.test',enabled:false})).status,403);
  const employee={...body,email:'employee@example.test',role:'team',projects:[]};assert.equal((await call('admin',path,employee)).status,200);
  assert.equal((await call('admin',path,{...employee,version:1,projects:['amklinika-k8m2']})).status,200);
  assert.equal(db.prepare("SELECT m.role FROM project_memberships m JOIN users u ON u.id=m.user_id WHERE u.email='employee@example.test'").get().role,'buyer');
  assert.equal((await call('admin',path,{...body,email:'admin@example.test',role:'team'})).status,403);
  assert.throws(()=>db.prepare("UPDATE users SET status='disabled' WHERE id='admin'").run(),/last_admin_required/);
 }finally{db.close();}
});
test('grant removal immediately blocks existing team sessions and rotates browser cache scope',async()=>{
 const {db,call}=setup();try{
  const before=await(await call('team','/master/')).text(),scope=before.match(/TOYS_CACHE_SCOPE="([a-f0-9]+)"/)[1];
  assert.equal((await call('admin','/api/v2/master/access',{email:'team@example.test',name:'Team',role:'team',enabled:true,projects:[],version:0})).status,200);
  assert.equal((await call('team',base+'/crm')).status,403);assert.equal((await call('team',base+'/dashboard')).status,403);
  const after=await(await call('team','/master/')).text();assert.notEqual(after.match(/TOYS_CACHE_SCOPE="([a-f0-9]+)"/)[1],scope);
  const master=await(await call('team','/api/v2/master')).json();assert.deepEqual(master.projects,[]);
  assert.equal((await call('admin','/api/v2/master/access',{email:'team@example.test',name:'Team',role:'team',enabled:false,projects:[],version:1})).status,200);
  assert.equal((await call('team','/api/v2/master')).status,401);
 }finally{db.close();}
});

test('morning review payload and priority counts exclude unassigned projects',async()=>{
 const {db,call}=setup();try{
  db.exec("INSERT INTO agency_daily_reviews(organization_id,report_date,state,generated_at) VALUES('org_toys_agency','2026-10-16','complete','2026-10-16T05:30:00Z')");
  for(const [id,slug,priority] of [['prj_housevip_cxp7','housevip-cxp7','healthy'],['p2','amklinika-k8m2','critical']])db.prepare("INSERT INTO agency_project_reviews(organization_id,report_date,project_id,priority,generated_at,payload_json) VALUES('org_toys_agency','2026-10-16',?,?,'2026-10-16T05:30:00Z',?)").run(id,priority,JSON.stringify({project:{id,slug,name:slug},priority}));
  const d=await(await call('team','/api/v2/master/daily-review')).json();assert.deepEqual(d.reports.map(r=>r.project.slug),['housevip-cxp7']);assert.equal(d.counts.critical,0);assert.equal(d.counts.healthy,1);assert.equal(d.currentRun,null);
  assert.equal((await(await call('admin','/api/v2/master/daily-review')).json()).reports.length,2);
 }finally{db.close();}
});

test('campaign controls require assigned staff; the change journal is admin-only, including direct API calls',async()=>{
 const {db,env,call}=setup();try{
  Object.assign(env,{META_ADS_ACCESS_TOKEN:'synthetic',META_APP_SECRET:'synthetic'});
  const control=base+'/campaign-control',status=base+'/campaign-browser/'+'a'.repeat(64)+'/status?from=2026-10-07&to=2026-10-07';
  for(const who of ['admin','team'])assert.deepEqual((await(await call(who,control)).json()).providers,['meta_ads']);
  assert.equal((await(await call('client',control)).json()).canManage,false);
  for(const who of ['client','empty','other'])assert.equal((await call(who,status,{status:'PAUSED',expectedStatus:'ACTIVE'})).status,403);
  for(const who of ['team','client','empty'])assert.equal((await call(who,'/api/v2/master/audit')).status,403);
  const created=await(await call('team',base+'/crm',{name:'History test',phone:'+12345'})).json();
  const history=await(await call('admin','/api/v2/master/audit?category=crm')).json();assert.equal(history.ok,true);assert.ok(history.events.some(e=>e.entityId===created.lead.id&&e.actor==='team@example.test'));
  assert.equal((await call('team','/api/v2/master/audit?event='+encodeURIComponent(history.events[0].id))).status,403);
 }finally{db.close();}
});

test('private sales demo is admin-only even with explicit grants and public allowlist misconfiguration',async()=>{
 const {db,env,call}=setup();try{
  db.exec(readFileSync('dist/sales-demo/import.sql','utf8'));
  env.MVP_PUBLIC_VIEW_PROJECTS+=',nova-sales-demo';env.MVP_PUBLIC_PROJECT_MATERIALS+=',nova-sales-demo';
  for(const [who,role] of [['team','buyer'],['client','client_manager']])db.prepare("INSERT INTO project_memberships(project_id,user_id,role) VALUES('prj_nova_sales_demo',?,?)").run(who,role);
  const root='/api/v2/projects/nova-sales-demo';
  const paths=['/nova-sales-demo/','/nova-sales-demo/index.html',root+'/board',root+'/board?ui=core/core.js',root+'/content-project',root+'/content-editor',root+'/dashboard?from=2026-08-01&toExclusive=2026-10-20',root+'/crm',root+'/crm/summary?from=2026-08-01&to=2026-10-19',root+'/content/reports',root+'/content/tabs',root+'/weekly-reports',root+'/top-creatives?from=2026-08-01&to=2026-10-19',root+'/campaign-browser?from=2026-08-01&to=2026-10-19','/api/v2/master/projects/nova-sales-demo/summary?from=2026-08-01&to=2026-10-19'];
  for(const path of paths){for(const who of ['team','client','empty'])assert.equal((await call(who,path)).status,403,who+' '+path);const anon=await worker.fetch(new Request('https://test.local'+path),env);assert.ok([401,403].includes(anon.status),'anonymous '+path);}
  for(const path of ['/nova-sales-demo/',root+'/dashboard?from=2026-08-01&toExclusive=2026-10-20',root+'/crm',root+'/content/reports',root+'/content/tabs'])assert.equal((await call('admin',path)).status,200,'admin '+path);
  const admin=await(await call('admin','/api/v2/master')).json();assert.ok(admin.projects.some(p=>p.slug==='nova-sales-demo'));
  const team=await(await call('team','/api/v2/master')).json();assert.ok(!team.projects.some(p=>p.slug==='nova-sales-demo'));
  const access=await(await call('admin','/api/v2/master/access')).json();assert.ok(!access.projects.some(p=>p.slug==='nova-sales-demo'));
  assert.equal((await call('admin','/api/v2/master/access',{name:'Demo client',email:'demo-recipient@example.test',role:'client',enabled:true,version:0,projects:['nova-sales-demo']})).status,400);
 }finally{db.close();}
});
