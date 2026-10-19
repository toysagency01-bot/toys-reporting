export async function crmAllowed(env,slug,auth){
 if(!auth?.ok)return false;
 if(auth.platformRole==='admin')return true;
 const config=await env.TOYS_DB.prepare('SELECT c.access_mode FROM crm_projects c JOIN projects p ON p.id=c.project_id WHERE p.slug=?').bind(slug).first();
 return config?.access_mode!=='admin';
}
