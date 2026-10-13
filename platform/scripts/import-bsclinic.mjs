// Resumable first-project migration. Raw captures must stay outside Git.
// node --use-env-proxy scripts/import-bsclinic.mjs PRIVATE_ROOT --cloudflare [--apply]
// node scripts/import-bsclinic.mjs PRIVATE_ROOT --sqlite PRIVATE_DB [--apply]
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const args=process.argv.slice(2),root=resolve(args[0]||''),apply=args.includes('--apply');
if(!args[0]||!relative(resolve('..'),root).startsWith('..'))throw Error('Private root outside Git required');
const project=JSON.parse(readFileSync(join(root,'prepared/project.json'))),org='org_toys_agency';
if(project.id!=='prj_bs_clinic_a5b4'||project.slug!=='bs-clinic-a5b4')throw Error('Unexpected migration scope');
const rt=await import(pathToFileURL(join(root,'prepared/runtime-reader.mjs')));
let query,batch,close=()=>{};
const quote=v=>v==null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
function bound(s){let i=0;const sql=s.sql.replace(/\?/g,()=>quote(s.params[i++]));if(i!==s.params.length)throw Error('Binding mismatch');return sql;}
if(args.includes('--sqlite')){
 const sqlite=new DatabaseSync(args[args.indexOf('--sqlite')+1]);sqlite.exec('PRAGMA foreign_keys=ON');
 query=async(sql,params=[])=>({success:true,results:sqlite.prepare(sql).all(...params)});
 batch=async ss=>{sqlite.exec('BEGIN IMMEDIATE');try{const out=[];for(const s of ss)out.push(await query(s.sql,s.params));sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}};close=()=>sqlite.close();
}else if(args.includes('--cloudflare')){
 const endpoint='https://api.cloudflare.com/client/v4/accounts/6e1e68500c0dc88e70dde2da4117c79d/d1/database/0539d3d9-844e-470e-af6e-ae256fe4c81f/query';
 const api=async body=>{const response=await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});const result=await response.json();if(!response.ok||!result.success||!result.result.every(r=>r.success))throw Error('D1 request failed: '+JSON.stringify(result.errors||[]));return result.result;};
 query=async(sql,params=[])=>{const result=await api({sql,params});if(result.length!==1)throw Error('Unexpected response');return result[0];};
 batch=async ss=>api({sql:ss.map(bound).join(';\n')});
}else throw Error('Choose --sqlite or --cloudflare');
class Statement{constructor(sql){this.sql=sql;this.params=[];}bind(...v){this.params=v;return this;}async first(){return(await query(this.sql,this.params)).results[0]||null;}all(){return query(this.sql,this.params);}run(){return query(this.sql,this.params);}}
const db={prepare:sql=>new Statement(sql),batch,batchSize:40},at=new Date().toISOString();
try{
 const registry=await db.prepare('SELECT status,organization_id FROM projects WHERE id=? AND slug=?').bind(project.id,project.slug).first();
 if(!registry||registry.organization_id!==org)throw Error('Project registry mismatch');
 const pointer=await db.prepare('SELECT release_id FROM project_data_release_pointers WHERE project_id=?').bind(project.id).first();
 if(pointer&&pointer.release_id!==project.releaseId)throw Error('A different release exists; preserve it and reconcile first');
 if(!pointer&&registry.status!=='draft')throw Error('Only a draft first release can be migrated');
 for(const t of project.projectTabs){const old=await db.prepare('SELECT source_hash FROM project_tabs WHERE project_id=? AND tab_key=?').bind(project.id,t.tabKey).first();if(old&&old.source_hash!==t.sourceHash)throw Error('Existing material changed: '+t.tabKey);}
 if(!apply){console.log(JSON.stringify({status:'preflight_passed',project:project.slug,rows:project.streams[0].rows.length,materials:project.projectTabs.length}));process.exit(0);}
 const reconciliations=[];
 for(const stream of project.streams){const result=await rt.stageStream(db,project,stream,at);reconciliations.push(result);console.log(JSON.stringify({stage:'history',verified:result.ok,rows:stream.rows.length}));}
 // Parameterized individual statements support large legacy reports without embedding
 // their content into SQL. The project remains inaccessible until the final pointer.
 for(const t of project.projectTabs){
  const content=JSON.stringify(t.content),raw=JSON.stringify(t.rawContent);
  await query('INSERT OR IGNORE INTO project_tabs(id,project_id,channel,tab_key,source_title,label,mode,position,content_json,raw_content_json,source_hash,imported_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[t.id,project.id,t.channel,t.tabKey,t.sourceTitle,t.label,t.mode,t.position,content,raw,t.sourceHash,at,at]);
  const stored=await db.prepare('SELECT content_json,raw_content_json,source_hash FROM project_tabs WHERE id=? AND project_id=?').bind(t.id,project.id).first();
  if(stored?.content_json!==content||stored.raw_content_json!==raw||stored.source_hash!==t.sourceHash)throw Error('Material readback mismatch: '+t.tabKey);
 }
 for(const r of project.weeklyReports){
  const fields=['id','project_id','period_start','period_end','summary','wins','issues','changes','next_steps','status','created_at','updated_at'];
  const values=[r.id,project.id,r.periodStart,r.periodEnd,r.summary,r.wins,r.issues,r.changes,r.nextSteps,r.status,r.createdAt||at,r.updatedAt||at];
  await query('INSERT OR IGNORE INTO weekly_reports('+fields.join(',')+') VALUES('+fields.map(()=>'?').join(',')+')',values);
  const stored=await db.prepare('SELECT * FROM weekly_reports WHERE id=? AND project_id=?').bind(r.id,project.id).first();
  if(fields.some((key,i)=>stored?.[key]!==values[i]))throw Error('Weekly readback mismatch');
 }
 console.log(JSON.stringify({stage:'materials',verified:project.projectTabs.length,weeklyReports:project.weeklyReports.length}));
 // Extras are already staged and reconciled; publish only the original full manifest,
 // configuration and pointer as one small transaction. No existing project is rewritten.
 const result=await rt.importRealCommerceProject(db,{...project,projectTabs:[],weeklyReports:[]});
 writeFileSync(join(root,'prepared',(args.includes('--cloudflare')?'cloudflare':'local')+'-release.json'),JSON.stringify({...result,reconciliations},null,2));
 console.log(JSON.stringify({status:result.status,project:project.slug,releaseId:result.releaseId,verified:reconciliations.every(r=>r.ok)}));
}finally{close();}
