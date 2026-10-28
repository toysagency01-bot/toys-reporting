// Keep the authorization decision in the same transaction as durable writes.
export function actorGate(db,auth,projectId=null){
 if(!auth.userId)return {sql:'1=1',params:[]};
 const membership=auth.platformRole==='team'&&projectId?" AND EXISTS(SELECT 1 FROM project_memberships m WHERE m.user_id=u.id AND m.project_id=? AND m.role IN ('buyer','agency_admin'))":'';
 return {sql:`EXISTS(SELECT 1 FROM users u JOIN platform_user_roles r ON r.user_id=u.id WHERE u.id=? AND u.access_version=? AND u.status!='disabled' AND r.role=?${membership})`,params:[auth.userId,auth.accessVersion,auth.platformRole,...membership?[projectId]:[]]};
}
export async function guardedConnectionBatch(db,auth,p,action,statements,claim=null){
 const gate=actorGate(db,auth,p.id);
 if(claim){gate.sql+=" AND NOT EXISTS(SELECT 1 FROM project_setup_connections c WHERE c.project_id=? AND c.provider=? AND c.account_id IS NOT NULL AND c.account_id!=? AND c.state!='disconnected')";gate.params.push(p.id,claim.provider,claim.accountId);if(claim.rejectAPI){gate.sql+=" AND NOT EXISTS(SELECT 1 FROM project_setup_connections c WHERE c.project_id=? AND c.provider='google_ads' AND c.state='connected' AND json_extract(c.config_json,'$.source')='google_api')";gate.params.push(p.id);}}
 const audit=db.prepare(`INSERT INTO audit_log(project_id,action,entity_type,entity_id,after_json) VALUES(?,CASE WHEN ${gate.sql} THEN 'project.connection.updated' ELSE NULL END,'project',?,?)`).bind(p.id,...gate.params,p.id,JSON.stringify({actor:auth.subject,operation:action}));
 const revision=db.prepare("UPDATE projects SET settings_json=json_set(settings_json,'$.browserProject.contentRevision',?) WHERE id=?").bind('connection-'+crypto.randomUUID(),p.id);
 return db.batch([audit,...statements,revision]);
}
