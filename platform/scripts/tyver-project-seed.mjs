// One-time parameterized seed for the explicitly requested TYVER project.
// Output contains project configuration only. It never executes or grants roles.
import {normalizeSetup,browserProject,projectMaterials} from '../project-management/model.js';
import {createHash} from 'node:crypto';
const id='prj_managed_tyver_20261029',slug='project-tyver',client='client_managed_tyver_20261029',js=JSON.stringify,sha=s=>createHash('sha256').update(s).digest('hex');
const setup=normalizeSetup({name:'TYVER',type:'leadgen',analyticsProfile:'product_trial',timezone:'Asia/Tbilisi',channels:['meta'],crm:{kind:'none'},kpi:{metric:'leads'},brief:{},notes:{},startDate:'2026-10-29'});
const statements=[],add=(sql,...params)=>statements.push({sql,params});
add("INSERT OR IGNORE INTO clients(id,organization_id,slug,name) VALUES(?,'org_toys_agency',?,'TYVER')",client,slug);
add("INSERT OR IGNORE INTO projects(id,organization_id,slug,name,project_type,status,timezone,client_id,capabilities_json,active_preset,settings_json) VALUES(?,'org_toys_agency',?,'TYVER','leadgen','draft',?,?,?,'leadgen',?)",id,slug,setup.timezone,client,js(['ads','content','period_reports']),js({managedProject:true,setupCRM:'none',browserProject:browserProject({name:'TYVER'},setup)}));
add('INSERT OR IGNORE INTO project_setup_state(project_id,name_key,setup_json,created_by) VALUES(?,?,?,?)',id,'tyver',js(setup),'user_request:TYVER:20261029');
add("INSERT OR IGNORE INTO dashboard_config_revisions(id,organization_id,project_id,revision_number,schema_version,preset,config_json,status) VALUES(?,'org_toys_agency',?,1,'toys-dashboard-config/1.0','leadgen',?,'published')",'cfg_'+id,id,js({defaultView:'metrics',panels:['spend','impressions','clicks','ctr','reportedConversions','cpa'],currencyPolicy:'native',contentNavigation:['meta']}));
add("INSERT OR IGNORE INTO dashboard_config_pointers(organization_id,project_id,revision_id) VALUES('org_toys_agency',?,?)",id,'cfg_'+id);
for(const c of ['all','meta'])add("INSERT OR IGNORE INTO project_channels(organization_id,project_id,channel_key,label,status) VALUES('org_toys_agency',?,?,?,'active')",id,c,c==='all'?'Все':'Meta');
for(const [i,t] of projectMaterials(setup).entries())add('INSERT OR IGNORE INTO project_tabs(id,project_id,channel,tab_key,source_title,label,mode,position,content_json,raw_content_json,source_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)','managed-'+id+'-'+t.key,id,t.channel,t.key,t.title,t.label,t.mode,i,js(t.data),js(t.data),sha(js(t.data)));
const manifest=js({managedProject:true,datasets:[],sourceState:'not_configured'});
add("INSERT OR IGNORE INTO project_data_releases(id,organization_id,project_id,revision,status,manifest_json,source_hash) VALUES(?,'org_toys_agency',?,1,'sealed',?,?)",'rel_'+id,id,manifest,sha(manifest));
add("INSERT OR IGNORE INTO project_data_release_pointers(organization_id,project_id,release_id,pointer_revision) VALUES('org_toys_agency',?,?,1)",id,'rel_'+id);
add("INSERT OR IGNORE INTO audit_log(project_id,action,entity_type,entity_id,request_id,after_json) VALUES(?,'project.created','project',?,'authorized-tyver-20261029',?)",id,id,js({actor:'user_request',name:'TYVER',analyticsProfile:'product_trial'}));
add("UPDATE projects SET status='active' WHERE id=? AND status='draft' AND EXISTS(SELECT 1 FROM project_setup_state WHERE project_id=?) AND EXISTS(SELECT 1 FROM project_data_release_pointers WHERE project_id=?)",id,id,id);
console.log(js({id,slug,statements}));
