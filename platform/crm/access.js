export async function crmAllowed(env,slug,auth){
 if(!auth?.ok)return false;
 const project=await env.TOYS_DB.prepare("SELECT json_extract(settings_json,'$.setupCRM') AS crm FROM projects WHERE slug=?").bind(slug).first();if(project?.crm==='none')return false;
 if(auth.platformRole==='admin')return true;
 const config=await env.TOYS_DB.prepare('SELECT c.access_mode FROM crm_projects c JOIN projects p ON p.id=c.project_id WHERE p.slug=?').bind(slug).first();
 return config?.access_mode!=='admin';
}
