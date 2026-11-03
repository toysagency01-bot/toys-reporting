import {readJSON,reply} from '../crm/service.js';
import {sameOriginWrite} from '../runtime/backend.js';

const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const validId=id=>/^[a-z][a-z0-9_-]{0,70}$/.test(id);
const row=p=>({id:p.id,parentId:p.parent_id,title:p.title,body:p.body,version:p.version,updatedAt:p.updated_at});

// Master authentication resolves the current platform role from D1 on every
// request. The browser's editor visibility never grants write authorization.
export async function wikiAPI(request,env,auth,path=''){
 try{
  if(!['admin','team'].includes(auth.platformRole))fail('wiki_forbidden',403);
  const admin=auth.platformRole==='admin',db=env.TOYS_DB,url=new URL(request.url);
  if(path===''&&request.method==='GET'){
   const q=(url.searchParams.get('q')||'').trim();if(q.length>150)fail('invalid_wiki_search');
   const pages=(await db.prepare('SELECT id,parent_id,title,sort_order,version,updated_at FROM wiki_pages ORDER BY sort_order,id').all()).results;
   // Search the bounded editorial corpus in JS: SQLite lower() is ASCII-only.
   let results=null;
   if(q){
    const needle=q.toLocaleLowerCase('ru'),all=(await db.prepare('SELECT id,title,body FROM wiki_pages ORDER BY sort_order,id').all()).results;
    results=all.filter(p=>p.title.toLocaleLowerCase('ru').includes(needle)||p.body.toLocaleLowerCase('ru').includes(needle)).slice(0,100).map(p=>{const at=p.body.toLocaleLowerCase('ru').indexOf(needle);return {id:p.id,title:p.title,excerpt:p.body.slice(Math.max(0,at-90),Math.max(0,at-90)+260)};});
   }
   return reply({ok:true,canEdit:admin,pages:pages.map(p=>({id:p.id,parentId:p.parent_id,title:p.title,sortOrder:p.sort_order,version:p.version,updatedAt:p.updated_at})),results});
  }
  const match=path.match(/^pages\/([^/]+)(?:\/history(?:\/(\d+))?)?$/);
  if(!match||!validId(match[1]))fail('wiki_not_found',404);
  const id=match[1],history=path.includes('/history');
  if((history||request.method!=='GET')&&!admin)fail('admin_role_required',403);
  const current=await db.prepare('SELECT * FROM wiki_pages WHERE id=?').bind(id).first();if(!current)fail('wiki_not_found',404);
  if(request.method==='GET'){
   if(history&&match[2]){
    const version=Number(match[2]);if(!Number.isSafeInteger(version)||version<1)fail('wiki_not_found',404);
    const revision=await db.prepare('SELECT version,title,body,actor,created_at AS createdAt FROM wiki_revisions WHERE page_id=? AND version=?').bind(id,version).first();if(!revision)fail('wiki_not_found',404);
    return reply({ok:true,revision});
   }
   if(history)return reply({ok:true,revisions:(await db.prepare('SELECT version,title,actor,created_at AS createdAt FROM wiki_revisions WHERE page_id=? ORDER BY version DESC LIMIT 100').bind(id).all()).results});
   return reply({ok:true,canEdit:admin,page:row(current)});
  }
  if(request.method!=='PUT'||history)fail('method_not_allowed',405);
  if(!sameOriginWrite(request))fail('origin_forbidden',403);
  const data=await readJSON(request),title=typeof data?.title==='string'?data.title.trim():'';
  if(!title||title.length>180||typeof data?.body!=='string'||data.body.length>60000||!data.body.trim()||!Number.isSafeInteger(data.version)||data.version<1)fail('invalid_wiki_page');
  if(current.version!==data.version)fail('wiki_version_conflict',409);
  if(title===current.title&&data.body===current.body)return reply({ok:true,page:row(current)});
  const token=crypto.randomUUID(),actor=auth.subject||auth.userId||'admin',now=new Date().toISOString();
  const results=await db.batch([
   db.prepare('UPDATE wiki_pages SET title=?,body=?,version=version+1,write_token=?,updated_by=?,updated_at=? WHERE id=? AND version=?').bind(title,data.body,token,actor,now,id,data.version),
   db.prepare('INSERT INTO wiki_revisions(page_id,version,title,body,actor,created_at) SELECT id,version,title,body,updated_by,updated_at FROM wiki_pages WHERE id=? AND write_token=?').bind(id,token),
   db.prepare("INSERT INTO audit_log(action,entity_type,entity_id,before_json,after_json) SELECT 'wiki.updated','wiki',?,json_object('name',?,'version',?),json_object('actor',?,'name',?,'version',?) WHERE EXISTS(SELECT 1 FROM wiki_pages WHERE id=? AND write_token=?)").bind(id,current.title,current.version,actor,title,current.version+1,id,token)
  ]);
  if(!results[0].meta.changes)fail('wiki_version_conflict',409);
  return reply({ok:true,page:row({...current,title,body:data.body,version:current.version+1,updated_at:now})});
 }catch(e){return reply({ok:false,error:e.code||'wiki_unavailable'},e.status||503);}
}
