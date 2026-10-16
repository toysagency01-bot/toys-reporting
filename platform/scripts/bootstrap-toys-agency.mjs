// First release from verified direct Meta snapshots. Captures stay outside Git.
// node [--use-env-proxy] scripts/bootstrap-toys-agency.mjs PRIVATE_ROOT [--apply]
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fixture,testWorker,request} from '../recovery-tests/fixture.mjs';
const root=resolve(process.argv[2]||''),apply=process.argv.includes('--apply');
if(!process.argv[2]||!relative(resolve('..'),root).startsWith('..'))throw Error('Private capture directory outside repository required');
process.umask(0o077);mkdirSync(join(root,'prepared'),{recursive:true});
const read=name=>JSON.parse(readFileSync(join(root,name),'utf8'));
const integration=read('integrations.json').find(i=>i.id==='int_toys_agency_meta');
assert.equal(integration?.external_account_id,'503232073666825');assert.equal(integration.project_id,'prj_toys_agency_ctft');
const config=JSON.parse(integration.config_json);assert.ok(config.accountMetadataCheckedAt);assert.ok(config.expectedCurrency);assert.ok(config.accountTimezone);
const project={id:integration.project_id,slug:'toys-agency-ctft',clientId:'client_toys_agency',clientSlug:'toys-agency',clientName:'TOYS AGENCY',preset:'leadgen',currency:config.expectedCurrency,timezone:config.accountTimezone,capabilities:['ads','content','period_reports'],channels:[['meta','Meta']],settings:{crmBackend:'d1'}};
const days=read(integration.id+'.snapshots.json');assert.equal(days.length,30);assert.equal(new Set(days.map(d=>d.local_date)).size,30);
assert.ok(days.every(d=>Date.now()-Date.parse(d.checked_at)<3600000),'Fresh first capture required');
const names=['finishStream','observation','observedMetric','finishProject','importRealCommerceProject'];
await build({stdin:{contents:readFileSync('runtime/backend.js','utf8')+'\nexport {'+names.join(',')+'};',resolveDir:resolve('runtime')},outfile:join(root,'prepared/runtime-reader.mjs'),bundle:true,format:'esm',platform:'node',plugins:[{name:'cf',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cf',namespace:'local'}));b.onLoad({filter:/.*/,namespace:'local'},()=>({contents:'export class WorkerEntrypoint {}'}));}}]});
const rt=await import(pathToFileURL(join(root,'prepared/runtime-reader.mjs')));
const descriptor={key:'toys_meta',channelKey:'meta',viewRole:'ads',deliveryProvider:'meta_graph_api',businessProvider:'meta_ads',stableSourceRef:'meta:503232073666825:direct-bootstrap',sourceTimezone:project.timezone,grain:'campaign_daily',sourceSchemaVersion:'toys-direct-bootstrap/1',attributionModel:'unknown',attributionWindow:'unknown'};
const rows=[];
for(const day of days){
 const data=JSON.parse(day.payload_json),account=data.hierarchy;assert.equal(data.integrationId,integration.id);assert.equal(account.providerId,integration.external_account_id);assert.equal(account.currency,project.currency);assert.equal(account.timezone,project.timezone);
 for(const c of account.children)for(const daily of c.dailyMetrics){
  assert.equal(daily.date,day.local_date);
  const fields={impressions:['ads.impressions','count'],clicks:['ads.clicks','count'],spend:['ads.spend','money'],conversions:['ads.reported_conversions','weighted_count']};
  const metrics=Object.entries(fields).map(([key,[code,unit]])=>rt.observedMetric(code,daily.metrics[key]?.state==='observed'?daily.metrics[key].value:null,unit,unit==='money'?project.currency:null,{basis:'platform_reported'}));
  rows.push(rt.observation(project,descriptor,daily,daily.date,{key:[daily.date,'meta',account.providerId,c.providerId],accountRef:account.providerId,providerCampaignId:c.providerId,campaign:c.name},metrics));
 }
}
const from=days[0].local_date,toExclusive=new Date(Date.parse(days.at(-1).local_date)+86400000).toISOString().slice(0,10);
const stream=rt.finishStream(project,descriptor,rows,{coverage:'complete',freshness:'fresh',requestedFrom:from,requestedToExclusive:toExclusive});
if(!rows.length){stream.observedFrom=from;stream.observedToExclusive=toExclusive;}
const prepared=rt.finishProject(project,[stream],[],[],{});prepared.manifest.leadgenChannels=true;
writeFileSync(join(root,'prepared/toys-project.json'),JSON.stringify(prepared));
// Exercise the exact first-release importer and normal dashboard APIs locally.
const {db,env}=fixture();
try{
 db.exec(readFileSync('migrations/0017_direct_ads.sql','utf8'));
 db.prepare("INSERT INTO projects(id,organization_id,slug,name,status) VALUES(?,'org_toys_agency',?,'TOYS AGENCY','draft')").run(project.id,project.slug);
 const result=await rt.importRealCommerceProject(env.TOYS_DB,prepared);assert.equal(result.status,'published');
 db.prepare("INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES(?,?,'meta_ads',?,'active',?)").run(integration.id,project.id,integration.external_account_id,integration.config_json);
 for(const d of days)db.prepare('INSERT INTO ads_daily_snapshots(scope_key,local_date,organization_id,project_id,integration_id,provider,payload_json,content_hash,checked_at) VALUES(?,?,\'org_toys_agency\',?,?,\'meta_ads\',?,\'fixture\',?)').run(d.scope_key,d.local_date,project.id,integration.id,d.payload_json,d.checked_at);
 env.MVP_VIEW_PROJECTS+=','+project.slug;env.MVP_EDITOR_PROJECTS+=','+project.slug;env.DIRECT_ADS_READ_ENABLED='true';
 const worker=await testWorker(),fetchBefore=globalThis.fetch;globalThis.fetch=()=>{throw Error('Dashboard must not fetch provider');};
 try{
  const base='/api/v2/projects/'+project.slug;
  for(const path of ['/'+project.slug+'/',base+'/dashboard',base+'/ads-summary?from='+from+'&to='+days.at(-1).local_date,base+'/crm']){
   const response=await worker.fetch(request(path),env,{waitUntil(){}});assert.equal(response.status,200,path+' '+(response.status!==200?await response.text():''));
   if(path.includes('ads-summary')){const body=await response.json();assert.equal(body.providers.length,1);assert.equal(body.providers[0].coverage,'complete');assert.equal(body.providers[0].coveredDates.length,30);}
  }
  if(process.argv.includes('--browser')){
   const {createServer}=await import('node:http'),{chromium}=await import('@playwright/test');
   const server=createServer(async(req,res)=>{try{const r=await worker.fetch(new Request('http://127.0.0.1'+req.url,{headers:{...req.headers,authorization:'Bearer synthetic-local-editor-token'}}),env,{waitUntil(){}});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(500);res.end('Local smoke test failed');}});
   await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
   const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
   try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
    await page.goto(base+'/'+project.slug+'/');await page.waitForSelector('body[data-platform-ready="true"]');
    assert.equal(await page.locator('#dateTo').inputValue(),days.at(-1).local_date);
    assert.equal((await page.locator('body').innerText()).includes('Не удалось загрузить борд'),false);
    await page.screenshot({path:join(root,'toys-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);console.log(JSON.stringify({stage:'browser_verified',desktop:true,mobile:true,pageErrors:0}));
   }finally{await browser.close();await new Promise(r=>server.close(r));}
  }
 }finally{globalThis.fetch=fetchBefore;}
 console.log(JSON.stringify({stage:'local_bootstrap_verified',rows:rows.length,currency:project.currency,timezone:project.timezone}));
}finally{db.close();}
if(!apply)process.exit(0);
const endpoint='https://api.cloudflare.com/client/v4/accounts/6e1e68500c0dc88e70dde2da4117c79d/d1/database/0539d3d9-844e-470e-af6e-ae256fe4c81f/query';
async function api(body){const r=await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});const data=await r.json();if(!r.ok||!data.success||!data.result.every(r=>r.success))throw Error('D1 publication failed');return data.result;}
class Statement{constructor(sql){this.sql=sql;this.params=[];}bind(...params){this.params=params;return this;}async first(){return(await this.all()).results[0]||null;}async all(){return(await api({sql:this.sql,params:this.params}))[0];}run(){return this.all();}}
const quote=v=>v==null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
const remote={prepare:sql=>new Statement(sql),batchSize:40,batch:async statements=>api({sql:statements.map(s=>{let n=0;const sql=s.sql.replace(/\?/g,()=>quote(s.params[n++]));assert.equal(n,s.params.length);return sql;}).join(';\n')})};
const current=await remote.prepare('SELECT status FROM projects WHERE id=? AND slug=?').bind(project.id,project.slug).first();assert.equal(current?.status,'draft','Only a first release may be published');
assert.equal(await remote.prepare('SELECT release_id FROM project_data_release_pointers WHERE project_id=?').bind(project.id).first(),null);
const result=await rt.importRealCommerceProject(remote,prepared);writeFileSync(join(root,'prepared/published.json'),JSON.stringify(result));console.log(JSON.stringify(result));
