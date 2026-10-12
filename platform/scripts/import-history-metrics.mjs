// Publish only reconciled Karlovarska metric generations. No content/config writes.
// Run reconciliation first; default mode is read-only preflight.
// node --use-env-proxy scripts/import-history-metrics.mjs PRIVATE_ROOT --cloudflare [--apply]
// node scripts/import-history-metrics.mjs PRIVATE_ROOT --sqlite LOCAL_FILE [--apply]
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const args=process.argv.slice(2),root=resolve(args[0]||''),apply=args.includes('--apply');
if(!args[0]||!relative(resolve(dirname(fileURLToPath(import.meta.url)),'../..'),root).startsWith('..'))throw new Error('Use a private root outside Git');
const read=file=>JSON.parse(readFileSync(join(root,file),'utf8'));
const rt=await import(pathToFileURL(join(root,'prepared/runtime-reader.mjs')));
const project=rt.parsePrivateSnapshot(read('prepared/commerce-input.json'),{projects:'karlovarska-sul-k4rm',projectTabs:read('prepared/karl-materials-input.json')}).projects[0];
const org='org_toys_agency',projectId='prj_karlovarska_sul_k4rm';
if(project.id!==projectId)throw new Error('Unexpected project scope');
const sqlQuote=value=>value==null?'NULL':typeof value==='number'&&Number.isFinite(value)?String(value):"'"+String(value).replaceAll("'","''")+"'";
function boundSQL(statement){let index=0;const sql=statement.sql.replace(/\?/g,()=>{if(index>=statement.params.length)throw new Error('Missing SQL binding');return sqlQuote(statement.params[index++]);});
 if(index!==statement.params.length)throw new Error('Unused SQL binding');return sql;}
let query,batch,close=()=>{};
if(args.includes('--sqlite')){
 const path=args[args.indexOf('--sqlite')+1];if(!path)throw new Error('SQLite path required');
 const sqlite=new DatabaseSync(path);sqlite.exec('PRAGMA foreign_keys=ON');
 query=async(sql,params=[])=>({results:sqlite.prepare(sql).all(...params),success:true});
 batch=async(statements)=>{sqlite.exec('BEGIN IMMEDIATE');try{const result=[];for(const s of statements)result.push(await query(s.sql,s.params));sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}};
 close=()=>sqlite.close();
}else if(args.includes('--cloudflare')){
 const endpoint='https://api.cloudflare.com/client/v4/accounts/6e1e68500c0dc88e70dde2da4117c79d/d1/database/0539d3d9-844e-470e-af6e-ae256fe4c81f/query';
 const request=async body=>{const response=await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  const result=await response.json();if(!response.ok||!result.success||!result.result.every(r=>r.success))throw new Error('D1 request failed: '+JSON.stringify(result.errors||[]));return result.result;};
 query=async(sql,params=[])=>{const result=await request({sql,params});if(result.length!==1)throw new Error('Unexpected result count');return result[0];};
 batch=async(statements)=>request({sql:statements.map(boundSQL).join(';\n')});
}else throw new Error('Select --sqlite or --cloudflare');
class Statement{constructor(sql){this.sql=sql;this.params=[];}bind(...params){this.params=params;return this;}async first(){return(await query(this.sql,this.params)).results[0]||null;}all(){return query(this.sql,this.params);}run(){return query(this.sql,this.params);}}
const db={prepare:sql=>new Statement(sql),batch,batchSize:40};
const first=async(sql,...params)=>db.prepare(sql).bind(...params).first();
try{
 const expected=read('platform-before/project_data_release_pointers.json').find(p=>p.project_id===projectId);
 const current=await first('SELECT * FROM project_data_release_pointers WHERE organization_id=? AND project_id=?',org,projectId);
 if(!current||!expected)throw new Error('Active release missing');
 const release=await first('SELECT * FROM project_data_releases WHERE organization_id=? AND project_id=? AND id=?',org,projectId,current.release_id);
 const manifest=JSON.parse(release.manifest_json);
 const activeStreams=[...(manifest.datasets||[]),...(manifest.auxiliaryStreams||[])];
 const alreadyCurrent=project.streams.every(stream=>activeStreams.some(s=>s.key===stream.key&&s.generationId===stream.generationId));
 const reconciliations={};
 if(alreadyCurrent){
  for(const stream of project.streams){const result=await rt.reconcileGeneration2(db,project,stream);if(!result.ok)throw new Error('Active metric readback mismatch');reconciliations[stream.key]=result;}
 }else{
  if(current.release_id!==expected.release_id||current.pointer_revision!==expected.pointer_revision)throw new Error('Release changed since capture; reconcile newer data first');
  await rt.preflightRealCommerceProject(db,project);
  // Business-only archive must already be sealed in this target database.
  const archive=read('prepared/archive.json');
  if(archive.scope!=='business_source_history_only')throw new Error('Unexpected archive scope');
  const stored=(await query('SELECT id,source_hash,complete FROM source_history_snapshots WHERE project_id=?',[projectId])).results;
  for(const item of archive.snapshots.filter(s=>s.project_id===projectId)){
   if(!stored.some(s=>s.id===item.id&&s.source_hash===item.source_hash&&s.complete===1))throw new Error('Verified source archive required');
  }
  if(apply){
   const at=new Date().toISOString();
   for(const stream of project.streams){reconciliations[stream.key]=await rt.stageStream(db,project,stream,at);console.log(JSON.stringify({staged:stream.key,observations:stream.rows.length,verified:reconciliations[stream.key].ok}));}
   const tabs=(await query('SELECT source_title AS sourceTitle,source_hash AS sourceHash FROM project_tabs WHERE project_id=? ORDER BY position,source_title',[projectId])).results;
   // Reference the material hashes actually stored, without overwriting materials
   // or native editor revisions as the older general-purpose importer would do.
   const candidate=rt.finishProject(project,project.streams,project.weeklyReports,tabs,{});
   const check=await first('SELECT * FROM project_data_release_pointers WHERE organization_id=? AND project_id=?',org,projectId);
   if(check.release_id!==current.release_id||check.pointer_revision!==current.pointer_revision)throw new Error('Concurrent release preserved; staged data remains unpublished');
   await db.batch([
    db.prepare(`INSERT OR IGNORE INTO project_data_releases (id,organization_id,project_id,revision,status,manifest_json,source_hash,created_at)
      SELECT ?,?,?,COALESCE(MAX(revision),0)+1,'sealed',?,?,? FROM project_data_releases WHERE organization_id=? AND project_id=?`)
      .bind(candidate.releaseId,org,projectId,JSON.stringify(candidate.manifest),candidate.sourceHash,at,org,projectId),
    db.prepare('UPDATE project_data_release_pointers SET release_id=?,pointer_revision=pointer_revision+1,updated_at=? WHERE organization_id=? AND project_id=? AND release_id=? AND pointer_revision=?')
      .bind(candidate.releaseId,at,org,projectId,current.release_id,current.pointer_revision)
   ]);
   const published=await first('SELECT * FROM project_data_release_pointers WHERE organization_id=? AND project_id=?',org,projectId);
   if(published.release_id!==candidate.releaseId)throw new Error('Release CAS failed; concurrent release preserved');
  }
 }
 const result={project:project.slug,status:alreadyCurrent?'already_current':apply?'published':'preflight_passed',reconciliations};
 writeFileSync(join(root,'prepared',(args.includes('--cloudflare')?'cloudflare':'local')+'-metrics-'+(apply?'apply':'preflight')+'.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({project:project.slug,status:result.status,verifiedStreams:Object.keys(reconciliations).length}));
}finally{close();}
