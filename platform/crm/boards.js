import {validatePipeline} from './board-schema.js';
export {validatePipeline} from './board-schema.js';
import {PIPELINES,projectPipeline,statusExpression} from './pipelines.js';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
export const boardId=value=>value==null||value===''||value==='default'?null:String(value);
export async function getBoard(env,p,id){
 const selected=boardId(id);
 const settings=await env.TOYS_DB.prepare('SELECT name,pipeline_json,version FROM crm_board_settings WHERE project_id=? AND board_key=?').bind(p.id,selected||'default').first();
 if(!selected)return {id:'default',name:settings?.name||'Основная',pipeline:settings?JSON.parse(settings.pipeline_json):await projectPipeline(env,p),isDefault:true,version:settings?.version||0};
 const row=await env.TOYS_DB.prepare('SELECT id,name,pipeline_json FROM crm_boards WHERE id=? AND project_id=?').bind(selected,p.id).first();
 if(!row)fail('board_not_found',404);
 return {id:row.id,name:settings?.name||row.name,pipeline:JSON.parse(settings?.pipeline_json||row.pipeline_json),isDefault:false,version:settings?.version||0};
}
export async function listBoards(env,p){
 const rows=(await env.TOYS_DB.prepare('SELECT id,name,pipeline_json FROM crm_boards WHERE project_id=? ORDER BY created_at,id').bind(p.id).all()).results||[];
 return [await getBoard(env,p,null),...await Promise.all(rows.map(r=>getBoard(env,p,r.id)))];
}

export async function createBoard(env,p,body,actor,key){
 if(!key||key.length>150)fail('idempotency_key_required');
 const name=typeof body.name==='string'?body.name.trim():'';if(!name||name.length>80||/[\x00-\x1f]/.test(name))fail('invalid_board_name');
 const pipeline=validatePipeline(body.stages);
 const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const id='board_'+await digest(p.id+':'+key),requestHash=await digest(JSON.stringify({name,pipeline}));
 const old=await env.TOYS_DB.prepare('SELECT request_hash FROM crm_boards WHERE id=? AND project_id=?').bind(id,p.id).first();
 if(old){if(old.request_hash!==requestHash)fail('idempotency_conflict',409);return getBoard(env,p,id);}
 if(name.toLocaleLowerCase('ru')==='основная'||(await listBoards(env,p)).some(b=>b.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')))fail('board_name_exists',409);
 try{const inserted=await env.TOYS_DB.prepare('INSERT INTO crm_boards(id,project_id,name,pipeline_json,request_hash,created_by,created_at) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM crm_board_settings WHERE project_id=? AND name=? COLLATE NOCASE)').bind(id,p.id,name,JSON.stringify(pipeline),requestHash,actor,new Date().toISOString(),p.id,name).run();if(!inserted.meta?.changes)fail('board_name_exists',409);}
 catch(e){const retry=await env.TOYS_DB.prepare('SELECT request_hash FROM crm_boards WHERE id=? AND project_id=?').bind(id,p.id).first();if(retry?.request_hash===requestHash)return getBoard(env,p,id);if(retry)fail('idempotency_conflict',409);if(/UNIQUE/i.test(e.message))fail('board_name_exists',409);throw e;}
 return getBoard(env,p,id);
}
export const boardTemplates=()=>Object.values(PIPELINES).map(p=>({key:p.key,label:p.label,stages:p.stages}));

export async function boardDetails(env,p,id){
 const board=await getBoard(env,p,id),expression=statusExpression(board.pipeline);
 const counts=await env.TOYS_DB.prepare(`SELECT ${expression} AS status,COUNT(*) AS total FROM leads l WHERE l.project_id=? AND l.board_id IS ? AND l.deleted_at IS NULL GROUP BY ${expression}`).bind(p.id,boardId(id)).all();
 return {board,counts:counts.results};
}

export async function updateBoard(env,p,id,body,actor,key){
 if(!key||key.length>150)fail('idempotency_key_required');
 const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const requestHash=await digest(JSON.stringify({action:'board.update',id,...body}));
 const previous=await env.TOYS_DB.prepare('SELECT request_hash,response_json FROM crm_write_keys WHERE project_id=? AND request_key=?').bind(p.id,key).first();
 if(previous){if(previous.request_hash!==requestHash)fail('idempotency_conflict',409);return JSON.parse(previous.response_json);}
 const old=await getBoard(env,p,id),name=typeof body.name==='string'?body.name.trim():'';
 if(!name||name.length>80||/[\x00-\x1f]/.test(name))fail('invalid_board_name');
 if(!Number.isInteger(body.version)||body.version!==old.version)fail('board_version_conflict',409);
 if((await listBoards(env,p)).some(b=>b.id!==old.id&&b.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')))fail('board_name_exists',409);
 const pipeline=validatePipeline(body.stages),origins=new Map();
 for(let i=0;i<body.stages.length;i++){
  const origin=body.stages[i].origin;
  if(origin==null)continue;
  const source=old.pipeline.stages.find(s=>s.label===origin);
  if(!source||origins.has(origin))fail('invalid_board_stages');
  origins.set(origin,pipeline.stages[i]);
  // Preserve colors of existing stages across a rename/reorder.
  pipeline.stages[i].color=source.kind===pipeline.stages[i].kind?source.color:pipeline.stages[i].color;
 }
 const expression=statusExpression(old.pipeline),removed=old.pipeline.stages.filter(s=>!origins.has(s.label)).map(s=>s.label);
 const quote=s=>"'"+s.replaceAll("'","''")+"'";
 const occupied=removed.length?`EXISTS(SELECT 1 FROM leads l WHERE l.project_id=? AND l.board_id IS ? AND l.deleted_at IS NULL AND (${expression}) IN (${removed.map(quote).join(',')}))`:'0';
 const saleOrigins=[...origins].filter(([label,target])=>target.kind==='sale'&&old.pipeline.stages.find(s=>s.label===label).kind!=='sale').map(([label])=>label);
 if(saleOrigins.length){const sale=await env.TOYS_DB.prepare(`SELECT 1 AS found FROM leads l WHERE l.project_id=? AND l.board_id IS ? AND l.deleted_at IS NULL AND (${expression}) IN (${saleOrigins.map(quote).join(',')}) LIMIT 1`).bind(p.id,boardId(id)).first();if(sale)fail('board_sale_requires_transfer',409);}
 // Canonical labels are migrated atomically. Keep aliases only for historical
 // input labels that cannot collide with a current stage name.
 const labels=new Set(pipeline.stages.map(s=>s.label));
 pipeline.aliases=Object.fromEntries(Object.entries(old.pipeline.aliases||{}).filter(([,v])=>origins.has(v)).map(([k,v])=>[k,origins.get(v).label]).filter(([k])=>!labels.has(k)));
 const mapped=origins.size?'CASE ('+expression+') '+[...origins].map(([from,to])=>'WHEN '+quote(from)+' THEN '+quote(to.label)).join(' ')+' ELSE ('+expression+') END':expression;
 const token=crypto.randomUUID(),now=new Date().toISOString(),response={ok:true,board:{...old,name,pipeline,version:old.version+1}},db=env.TOYS_DB;
 const gate='EXISTS(SELECT 1 FROM crm_board_settings WHERE project_id=? AND board_key=? AND claim_token=?)';
 const gateArgs=[p.id,old.id,token];
 const changes=[
  db.prepare('INSERT INTO crm_board_settings(project_id,board_key,name,pipeline_json,version,updated_at) VALUES(?,?,?,?,0,?) ON CONFLICT(project_id,board_key) DO NOTHING').bind(p.id,old.id,old.name,JSON.stringify(old.pipeline),now),
  db.prepare(`UPDATE crm_board_settings SET name=?,pipeline_json=?,version=version+1,claim_token=?,updated_at=? WHERE project_id=? AND board_key=? AND version=? AND NOT EXISTS(SELECT 1 FROM crm_board_settings WHERE project_id=? AND board_key!=? AND name=? COLLATE NOCASE) AND NOT EXISTS(SELECT 1 FROM crm_boards WHERE project_id=? AND id!=? AND name=? COLLATE NOCASE) AND NOT (${occupied})${saleOrigins.length?` AND NOT EXISTS(SELECT 1 FROM leads l WHERE l.project_id=? AND l.board_id IS ? AND l.deleted_at IS NULL AND (${expression}) IN (${saleOrigins.map(quote).join(',')}))`:''}`).bind(name,JSON.stringify(pipeline),token,now,p.id,old.id,body.version,p.id,old.id,name,p.id,old.id,name,...(removed.length?[p.id,boardId(id)]:[]),...(saleOrigins.length?[p.id,boardId(id)]:[])),
  db.prepare(`INSERT INTO crm_lead_state(lead_id,version,updated_at) SELECT id,0,? FROM leads WHERE project_id=? AND board_id IS ? AND deleted_at IS NULL AND ${gate} ON CONFLICT(lead_id) DO NOTHING`).bind(now,p.id,boardId(id),...gateArgs),
  db.prepare(`UPDATE crm_lead_state SET version=version+1,updated_at=? WHERE lead_id IN(SELECT id FROM leads WHERE project_id=? AND board_id IS ? AND deleted_at IS NULL) AND ${gate}`).bind(now,p.id,boardId(id),...gateArgs),
  db.prepare(`UPDATE leads AS l SET current_status=${mapped},updated_at=? WHERE project_id=? AND board_id IS ? AND deleted_at IS NULL AND ${gate}`).bind(now,p.id,boardId(id),...gateArgs),
  db.prepare(`UPDATE crm_boards SET name=?,pipeline_json=? WHERE project_id=? AND id=? AND ${gate}`).bind(name,JSON.stringify(pipeline),p.id,old.id,...gateArgs),
  db.prepare(`INSERT INTO audit_log(project_id,action,entity_type,entity_id,before_json,after_json,request_id) SELECT ?,'crm.board.updated','crm_board',?,?,?,? WHERE ${gate}`).bind(p.id,old.id,JSON.stringify(old),JSON.stringify({...response.board,actor}),key,...gateArgs),
  db.prepare(`INSERT INTO crm_write_keys(project_id,request_key,request_hash,response_json,created_at) SELECT ?,?,?,?,? WHERE ${gate}`).bind(p.id,key,requestHash,JSON.stringify(response),now,...gateArgs)
 ];
 const result=await db.batch(changes);
 if(!result[1].meta?.changes)fail('board_changed_or_not_empty',409);
 return response;
}
