export const reportKey = key => /^weekly-(?:main|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(key);

export async function reportCollection(request,env,slug,{authorizeMvp,projectRecord,publicProjectMaterialAllowed,publicWeeklyRevision}){
 const editor=await authorizeMvp(request,env,slug,'editor');
 if(!editor.ok&&!publicProjectMaterialAllowed(env,slug)){
  const viewer=await authorizeMvp(request,env,slug,'viewer');
  if(!viewer.ok)return Response.json({ok:false,error:viewer.error},{status:viewer.status});
 }
 const project=await projectRecord(env,slug);
 if(!project)return Response.json({ok:false,error:'not_found'},{status:404});
 const args=[project.organizationId,project.id];
 const items=(await env.TOYS_DB.prepare(`SELECT id,logical_key AS logicalKey,title,latest_revision_number AS latestRevision,published_revision_id AS publishedRevisionId
 FROM content_items WHERE organization_id=? AND project_id=? AND kind='period_summary' AND lifecycle='active' ORDER BY created_at DESC,id DESC`).bind(...args).all()).results.filter(i=>reportKey(i.logicalKey));
 // Load just the latest draft and publication, in one query across the project.
 const rows=(await env.TOYS_DB.prepare(`SELECT r.content_item_id AS itemId,r.id,r.revision_number AS revisionNumber,r.status,r.author_ref AS authorRef,r.created_at AS createdAt,
 b.block_key AS blockKey,b.position,b.block_type AS type,b.payload_schema_version AS payloadSchemaVersion,b.payload_json AS payloadJson
 FROM content_items i JOIN content_revisions r ON r.content_item_id=i.id AND r.organization_id=i.organization_id AND r.project_id=i.project_id
 JOIN content_blocks b ON b.revision_id=r.id AND b.organization_id=r.organization_id AND b.project_id=r.project_id
 WHERE i.organization_id=? AND i.project_id=? AND i.kind='period_summary' AND i.lifecycle='active'
 AND (r.id=i.published_revision_id OR (?=1 AND r.revision_number=i.latest_revision_number)) ORDER BY b.position,b.block_key`).bind(...args,editor.ok?1:0).all()).results;
 const revisions=new Map();
 for(const row of rows){
  if(!revisions.has(row.id))revisions.set(row.id,{id:row.id,itemId:row.itemId,revisionNumber:row.revisionNumber,status:row.status,authorRef:row.authorRef,createdAt:row.createdAt,blocks:[]});
  revisions.get(row.id).blocks.push({blockKey:row.blockKey,position:row.position,type:row.type,payloadSchemaVersion:row.payloadSchemaVersion,payload:JSON.parse(row.payloadJson)});
 }
 const reports=items.map(item=>{
  const published=revisions.get(item.publishedRevisionId),safe=publicWeeklyRevision(published);
  return {logicalKey:item.logicalKey,publishedRevision:safe?(editor.ok?published:safe):null,
   ...(editor.ok?{item,latestRevision:[...revisions.values()].find(r=>r.itemId===item.id&&r.revisionNumber===item.latestRevision)||null}:{})};
 }).filter(r=>r.publishedRevision||r.latestRevision);
 const end=r=>(r.latestRevision||r.publishedRevision)?.blocks.find(b=>b.type==='period_summary')?.payload.periodEnd||'';
 reports.sort((a,b)=>end(b).localeCompare(end(a)));
 return Response.json({ok:true,canEdit:editor.ok,canDelete:editor.ok&&(await authorizeMvp(request,env,'__master','editor')).ok,reports},{headers:{'cache-control':'no-store'}});
}
