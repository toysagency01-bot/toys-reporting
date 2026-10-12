// One-time additive rollout deferred past the exhausted 12 October D1 allowance.
// Existing scheduled events retry it; browser GETs only report readiness.
export const SETUP_RETRY_AT='2026-10-13T00:00:00Z';
export async function accessSchemaReady(env){
 const columns=(await env.TOYS_DB.prepare("SELECT name FROM pragma_table_info('users') WHERE name IN ('access_version','access_claim')").all()).results;
 return columns.length===2&&Boolean(await env.TOYS_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='portal_access_writes'").first());
}
export async function prepareAccessSchema(env){
 if(await accessSchemaReady(env))return true;
 if(Date.now()<Date.parse(SETUP_RETRY_AT))return false;
 // Read each column again before DDL, recovering a partially completed migration.
 for(const [name,type]of [['access_version','INTEGER NOT NULL DEFAULT 0'],['access_claim','TEXT']]){
  if(!(await env.TOYS_DB.prepare("SELECT name FROM pragma_table_info('users') WHERE name=?").bind(name).first())){
   try{await env.TOYS_DB.prepare(`ALTER TABLE users ADD COLUMN ${name} ${type}`).run();}
   catch(error){if(!(await env.TOYS_DB.prepare("SELECT name FROM pragma_table_info('users') WHERE name=?").bind(name).first()))throw error;}
  }
 }
 await env.TOYS_DB.prepare("CREATE TABLE IF NOT EXISTS portal_access_writes (request_key TEXT PRIMARY KEY, request_hash TEXT NOT NULL, response_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
 return accessSchemaReady(env);
}
