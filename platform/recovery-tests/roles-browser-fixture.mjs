import {createHash} from 'node:crypto';
export function roleBrowserFixture(env,db){
 Object.assign(env,{ENVIRONMENT:'staging',PASSWORD_AUTH_ENABLED:'true'});
 db.exec("INSERT INTO projects(id,organization_id,slug,name,project_type,status,currency,client_id,capabilities_json,active_preset) VALUES('private-clinic','org_toys_agency','amklinika-k8m2','AM Klinika','leadgen','active','EUR','client_housevip','[]','leadgen')");
 const tokens={admin:'a'.repeat(64),team:'b'.repeat(64),client:'c'.repeat(64),empty:'d'.repeat(64)};
 for(const [id,token]of Object.entries(tokens)){
  const role=id==='empty'?'team':id;
  db.prepare("INSERT INTO users(id,email,display_name,status) VALUES(?,?,?,'active')").run('role-'+id,id+'@roles.test',id==='team'?'Сотрудник TOYS':id==='admin'?'Администратор TOYS':id);
  db.prepare('INSERT INTO platform_user_roles(user_id,role) VALUES(?,?)').run('role-'+id,role);
  db.prepare("INSERT INTO portal_credentials(user_id,password_hash,updated_at) VALUES(?,'unused',datetime('now'))").run('role-'+id);
  db.prepare('INSERT INTO portal_sessions(token_hash,user_id,credential_version,expires_at,created_at) VALUES(?,?,1,?,?)').run(createHash('sha256').update(token).digest('hex'),'role-'+id,Math.floor(Date.now()/1000)+3600,Math.floor(Date.now()/1000));
  if(['team','client'].includes(id))db.prepare('INSERT INTO project_memberships(project_id,user_id,role) VALUES(?,?,?)').run('prj_housevip_cxp7','role-'+id,id==='team'?'buyer':'client_manager');
 }
 return tokens;
}
