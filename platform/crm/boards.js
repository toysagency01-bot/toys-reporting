import {PIPELINES,projectPipeline} from './pipelines.js';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
export const boardId=value=>value==null||value===''||value==='default'?null:String(value);
export async function getBoard(env,p,id){
 const selected=boardId(id);
 if(!selected)return {id:'default',name:'Основная',pipeline:await projectPipeline(env,p),isDefault:true};
 const row=await env.TOYS_DB.prepare('SELECT id,name,pipeline_json FROM crm_boards WHERE id=? AND project_id=?').bind(selected,p.id).first();
 if(!row)fail('board_not_found',404);
 return {id:row.id,name:row.name,pipeline:JSON.parse(row.pipeline_json),isDefault:false};
}
export async function listBoards(env,p){
 const rows=(await env.TOYS_DB.prepare('SELECT id,name,pipeline_json FROM crm_boards WHERE project_id=? ORDER BY created_at,id').bind(p.id).all()).results||[];
 return [await getBoard(env,p,null),...rows.map(r=>({id:r.id,name:r.name,pipeline:JSON.parse(r.pipeline_json),isDefault:false}))];
}
export function validatePipeline(stages){
 if(!Array.isArray(stages)||stages.length<2||stages.length>30)fail('invalid_board_stages');
 const seen=new Set();const clean=stages.map((s,i)=>{
  const label=typeof s?.label==='string'?s.label.trim():'';
  if(!label||label.length>80||/[\x00-\x1f]/.test(label)||seen.has(label.toLocaleLowerCase('ru')))fail('invalid_board_stages');seen.add(label.toLocaleLowerCase('ru'));
  if(![null,undefined,'qualified','sale'].includes(s.kind))fail('invalid_board_stages');
  const kind=s.kind||null;
  if(i===0&&kind)fail('invalid_board_stages');
  return {label,color:kind==='sale'?'#79c981':kind==='qualified'?'#1dd3c5':'#8b949f',kind,...(s.countsAsQualified===true&&kind==='sale'?{countsAsQualified:true}:{})};
 });
 if(clean.filter(s=>s.kind==='sale').length!==1)fail('board_sale_stage_required');
 return {key:'custom',label:'Своя воронка',stages:clean};
}
export async function createBoard(env,p,body,actor,key){
 if(!key||key.length>150)fail('idempotency_key_required');
 const name=typeof body.name==='string'?body.name.trim():'';if(!name||name.length>80||/[\x00-\x1f]/.test(name))fail('invalid_board_name');
 const pipeline=validatePipeline(body.stages);
 const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const id='board_'+await digest(p.id+':'+key),requestHash=await digest(JSON.stringify({name,pipeline}));
 const old=await env.TOYS_DB.prepare('SELECT request_hash FROM crm_boards WHERE id=? AND project_id=?').bind(id,p.id).first();
 if(old){if(old.request_hash!==requestHash)fail('idempotency_conflict',409);return getBoard(env,p,id);}
 if(name.toLocaleLowerCase('ru')==='основная')fail('board_name_exists',409);
 try{await env.TOYS_DB.prepare('INSERT INTO crm_boards(id,project_id,name,pipeline_json,request_hash,created_by,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,p.id,name,JSON.stringify(pipeline),requestHash,actor,new Date().toISOString()).run();}
 catch(e){const retry=await env.TOYS_DB.prepare('SELECT request_hash FROM crm_boards WHERE id=? AND project_id=?').bind(id,p.id).first();if(retry?.request_hash===requestHash)return getBoard(env,p,id);if(retry)fail('idempotency_conflict',409);if(/UNIQUE/i.test(e.message))fail('board_name_exists',409);throw e;}
 return getBoard(env,p,id);
}
export const boardTemplates=()=>Object.values(PIPELINES).map(p=>({key:p.key,label:p.label,stages:p.stages}));
