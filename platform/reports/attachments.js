const MAX_BYTES=8*1024*1024, PROJECT_BYTES=256*1024*1024;
const types=new Set(['image/png','image/jpeg','image/webp']);
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
const key=(project,id)=>`reports/${project.organizationId}/${project.id}/${id}`;
const available=env=>Boolean(env.REPORT_ATTACHMENTS?.put&&env.REPORT_ATTACHMENTS?.get);
export async function validateReportAttachments(env,project,blocks){
 for(const block of blocks){
  if(block.type!=='period_summary')continue;
  const p=block.payload;
  if(p.channel!==undefined&&!['meta','google','smm',''].includes(p.channel))throw new Error('invalid_report_channel');
  if(p.attachments===undefined)continue;
  if(!Array.isArray(p.attachments)||p.attachments.length>8||new Set(p.attachments).size!==p.attachments.length)throw new Error('invalid_report_attachments');
  for(const id of p.attachments){
   if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw new Error('invalid_report_attachments');
   const row=await env.TOYS_DB.prepare('SELECT id FROM report_attachments WHERE organization_id=? AND project_id=? AND id=? AND ready=1').bind(project.organizationId,project.id,id).first();
   if(!row)throw new Error('invalid_report_attachments');
  }
 }
}
function isImage(b,type){
 if(type==='image/png')return [137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v);
 if(type==='image/jpeg')return b[0]===255&&b[1]===216&&b[2]===255;
 return b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP';
}
async function boundedBytes(request){
 if(Number(request.headers.get('content-length'))>MAX_BYTES)throw new Error('attachment_too_large');
 const reader=request.body?.getReader();if(!reader)throw new Error('invalid_image');
 const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES){await reader.cancel();throw new Error('attachment_too_large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}return bytes;
}
export async function reportAttachmentRoute(request,env,{authorizeMvp,projectRecord,publicProjectMaterialAllowed,sameOriginWrite}){
 const m=new URL(request.url).pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content\/weekly-main\/attachments(?:\/([a-f0-9]{64}))?$/);
 if(!m)return null;
 const [,,id]=m,slug=m[1];
 if(!['GET','POST'].includes(request.method)||(id&&request.method!=='GET'))return json({ok:false,error:'method_not_allowed'},405);
 const editor=await authorizeMvp(request,env,slug,'editor');
 if(!editor.ok){
  if(!id)return json({ok:false,error:editor.error},editor.status);
  if(!publicProjectMaterialAllowed(env,slug)){const auth=await authorizeMvp(request,env,slug,'viewer');if(!auth.ok)return json({ok:false,error:auth.error},auth.status);}
 }
 const project=await projectRecord(env,slug);if(!project)return json({ok:false,error:'not_found'},404);
 if(request.method==='GET'&&!id)return json({ok:true,available:available(env),maxBytes:MAX_BYTES,maxFiles:8});
 if(id){
  if(!editor.ok){
   const published=await env.TOYS_DB.prepare(`SELECT b.payload_json FROM content_items i JOIN content_blocks b ON b.revision_id=i.published_revision_id AND b.project_id=i.project_id AND b.organization_id=i.organization_id WHERE i.organization_id=? AND i.project_id=? AND i.kind='period_summary' AND i.logical_key LIKE 'weekly-%' AND i.lifecycle='active' AND b.block_type='period_summary'`).bind(project.organizationId,project.id).all();
   if(!published.results.some(b=>JSON.parse(b.payload_json).attachments?.includes(id)))return json({ok:false,error:'not_found'},404);
  }
  const row=await env.TOYS_DB.prepare('SELECT media_type FROM report_attachments WHERE organization_id=? AND project_id=? AND id=? AND ready=1').bind(project.organizationId,project.id,id).first();
  if(!row)return json({ok:false,error:'not_found'},404);
  if(!available(env))return json({ok:false,error:'report_storage_unavailable'},503);
  const object=await env.REPORT_ATTACHMENTS.get(key(project,id));if(!object)return json({ok:false,error:'not_found'},404);
  return new Response(object.body,{headers:{'content-type':row.media_type,'cache-control':'private, no-store','x-content-type-options':'nosniff','content-disposition':'inline','content-security-policy':"default-src 'none'; sandbox"}});
 }
 if(!sameOriginWrite(request))return json({ok:false,error:'origin_forbidden'},403);
 if(!available(env))return json({ok:false,error:'report_storage_unavailable'},503);
 const mediaType=request.headers.get('content-type')?.split(';')[0];if(!types.has(mediaType))return json({ok:false,error:'invalid_image'},400);
 let bytes;try{bytes=await boundedBytes(request);}catch(e){return json({ok:false,error:e.message},e.message==='attachment_too_large'?413:400);}
 if(!isImage(bytes,mediaType))return json({ok:false,error:'invalid_image'},400);
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const prior=await env.TOYS_DB.prepare('SELECT ready FROM report_attachments WHERE organization_id=? AND project_id=? AND id=?').bind(project.organizationId,project.id,digest).first();
 if(prior?.ready)return json({ok:true,id:digest});
 await env.TOYS_DB.prepare(`INSERT OR IGNORE INTO report_attachments (organization_id,project_id,id,media_type,byte_size,ready) SELECT ?,?,?,?,?,0 WHERE COALESCE((SELECT SUM(byte_size) FROM report_attachments WHERE organization_id=? AND project_id=?),0)+?<=?`).bind(project.organizationId,project.id,digest,mediaType,bytes.length,project.organizationId,project.id,bytes.length,PROJECT_BYTES).run();
 const reserved=await env.TOYS_DB.prepare('SELECT id FROM report_attachments WHERE organization_id=? AND project_id=? AND id=?').bind(project.organizationId,project.id,digest).first();
 if(!reserved)return json({ok:false,error:'report_storage_quota'},413);
 try{
  await env.REPORT_ATTACHMENTS.put(key(project,digest),bytes,{httpMetadata:{contentType:mediaType}});
  await env.TOYS_DB.prepare('UPDATE report_attachments SET ready=1 WHERE organization_id=? AND project_id=? AND id=?').bind(project.organizationId,project.id,digest).run();
 }catch{return json({ok:false,error:'attachment_upload_failed'},503);}
 return json({ok:true,id:digest});
}
