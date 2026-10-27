import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fixture,request,testWorker} from './fixture.mjs';
import {BRIEF_SOURCE,normalizeBrief,initialChecklist} from '../onboarding/model.js';
import {briefIntakeAPI,onboardingAPI,briefSetupAPI} from '../onboarding/api.js';
import {appsScriptSource} from '../onboarding/apps-script.js';
const token='synthetic-brief-intake-token-only-123456789';
function setup(){const f=fixture();f.env.BRIEF_INTAKE_TOKEN=token;f.db.prepare('INSERT INTO brief_sources(id,spreadsheet_id,sheet_id,sheet_name,timezone,drive_parent_id,enabled,accept_from) VALUES(?,?,?,?,?,?,1,?)').run(BRIEF_SOURCE.id,BRIEF_SOURCE.spreadsheetId,BRIEF_SOURCE.sheetId,BRIEF_SOURCE.sheetName,BRIEF_SOURCE.timezone,BRIEF_SOURCE.driveParentId,'2026-10-01T00:00:00Z');return f;}
function body(extra={}){return {schema:'toys-brief/v1',source:{spreadsheetId:BRIEF_SOURCE.spreadsheetId,sheetId:BRIEF_SOURCE.sheetId,row:119},submittedAt:'2026-10-27T10:00:00Z',headers:['Отметка времени','Сайт или страница компании','Опишите подробно продукты или услуги','Укажите ваши рабочие почты','Укажите цель рекламной кампании (KPI)','Есть ли у вас CRM система?'],values:['2026-10-27T10:00:00Z','https://synthetic.example.test','Synthetic product','test@example.invalid','Заявки','Да'],...extra};}
const incoming=(data,path='',bearer=token)=>new Request('https://test.local/api/v2/brief-intake'+path,{method:'POST',headers:{authorization:'Bearer '+bearer,'content-type':'application/json'},body:JSON.stringify(data)});
const admin={platformRole:'admin',subject:'synthetic-admin'};
async function ingest(f,data=body()){const r=await briefIntakeAPI(incoming(data),f.env);return {response:r,data:await r.json()};}
test('new brief creates one private draft with complete answers and no automatic connections or financial records',async()=>{
 const f=setup();try{
  const before=f.db.prepare('SELECT COUNT(*) n FROM finance_records').get().n;
  const {response,data}=await ingest(f);assert.equal(response.status,201);const row=f.db.prepare('SELECT * FROM projects WHERE id=?').get(data.project.id);assert.equal(row.status,'draft');assert.equal(row.project_type,'unconfigured');assert.equal(row.currency,null);assert.equal(row.timezone,null);
  assert.equal(row.name,'synthetic.example.test');assert.equal(f.db.prepare('SELECT COUNT(*) n FROM integrations WHERE project_id=?').get(row.id).n,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM crm_projects WHERE project_id=?').get(row.id).n,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM finance_records').get().n,before);
  const saved=f.db.prepare('SELECT * FROM project_onboarding WHERE project_id=?').get(row.id);assert.deepEqual(JSON.parse(saved.briefing_json),body().headers.map((question,i)=>({question,answer:body().values[i]})));assert.ok(JSON.parse(saved.checklist_json).every(t=>t.state==='todo'));
  assert.ok(JSON.parse(saved.profile_json).missing.includes('companyName'));
 }finally{f.db.close();}
});
test('brief retries and source row reordering do not duplicate projects, while conflicting same-timestamp answers are rejected',async()=>{
 const f=setup();try{const first=await ingest(f),second=await ingest(f,{...body(),source:{...body().source,row:150}});assert.equal(second.response.status,200);assert.equal(first.data.project.id,second.data.project.id);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM project_onboarding').get().n,1);
  const changed=body();changed.values[2]='Other product';assert.equal((await ingest(f,changed)).response.status,409);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM project_onboarding').get().n,1);
 }finally{f.db.close();}
});
test('intake rejects missing credentials, another sheet, old records and empty submissions',async()=>{
 const f=setup();try{
  assert.equal((await briefIntakeAPI(incoming(body(),'','wrong'),f.env)).status,401);
  assert.equal((await ingest(f,body({source:{...body().source,sheetId:1}}))).data.error,'brief_source_mismatch');
  assert.equal((await ingest(f,body({submittedAt:'2023-06-01T00:00:00Z'}))).data.error,'brief_before_activation');
  assert.equal((await ingest(f,body({values:body().values.map(()=>'' )}))).data.error,'brief_empty_submission');assert.equal(f.db.prepare('SELECT COUNT(*) n FROM project_onboarding').get().n,0);
 }finally{f.db.close();}
});
test('Drive folder acknowledgement is immutable and idempotent',async()=>{
 const f=setup();try{const {data}=await ingest(f),folder={projectId:data.project.id,folderId:'synthetic_drive_folder_id_123'};
  for(let i=0;i<2;i++)assert.equal((await briefIntakeAPI(incoming(folder,'/folder'),f.env)).status,200);
  assert.equal((await briefIntakeAPI(incoming({...folder,folderId:'different_drive_folder_456'},'/folder'),f.env)).status,409);
 }finally{f.db.close();}
});
test('Google installer can bind its own parent before the first project but cannot move an active source silently',async()=>{
 const f=setup();try{
  const check=parent=>incoming({spreadsheetId:BRIEF_SOURCE.spreadsheetId,sheetId:BRIEF_SOURCE.sheetId,driveParentId:parent},'/check');
  assert.equal((await briefIntakeAPI(check('synthetic_installer_owned_parent'),f.env)).status,200);
  const {data}=await ingest(f);assert.equal(data.driveParentId,'synthetic_installer_owned_parent');
  assert.equal((await briefIntakeAPI(check('different_parent_after_intake'),f.env)).status,409);
  assert.equal((await briefIntakeAPI(check('synthetic_installer_owned_parent'),f.env)).status,200);
 }finally{f.db.close();}
});
test('onboarding is limited to admins and assigned team, with protected updates and verification notes',async()=>{
 const f=setup();try{const {data}=await ingest(f),slug=data.project.slug,path='/api/v2/master/projects/'+slug+'/onboarding';
  for(const auth of [{platformRole:'client',projectSlugs:[slug]},{platformRole:'team',projectSlugs:[]}])assert.equal((await onboardingAPI(request(path),f.env,auth,slug)).status,403);
  assert.equal((await onboardingAPI(request(path),f.env,{platformRole:'team',projectSlugs:[slug]},slug)).status,200);
  const update=tasks=>new Request('https://test.local'+path,{method:'PATCH',headers:{origin:'https://test.local','content-type':'application/json'},body:JSON.stringify({version:0,tasks})});
  const tasks=initialChecklist();tasks.find(t=>t.id==='capi').state='done';assert.equal((await(await onboardingAPI(update(tasks),f.env,admin,slug)).json()).error,'onboarding_verification_required');
  tasks.find(t=>t.id==='capi').note='Synthetic test event verified';tasks[0].deadline='2026-11-05';tasks[0].owner='Synthetic buyer';assert.equal((await onboardingAPI(update(tasks),f.env,admin,slug)).status,200);assert.equal((await onboardingAPI(update(tasks),f.env,admin,slug)).status,409);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='project.onboarding.updated'").get().n,1);
 }finally{f.db.close();}
});
test('setup key is admin-only and intake credential cannot authorize master data',async()=>{
 const f=setup();try{const worker=await testWorker();f.env.MVP_EDITOR_PROJECTS+=',__master';
  assert.equal((await briefSetupAPI(request('/api/v2/master/brief-source/setup'),f.env,{platformRole:'team'})).status,403);
  const response=await briefSetupAPI(request('/api/v2/master/brief-source/setup'),f.env,admin);assert.equal(response.status,200);const data=await response.json();assert.equal(data.token,token);assert.ok(!data.script.includes(token));assert.match(response.headers.get('cache-control'),/no-store/);
  const denied=await worker.fetch(new Request('https://test.local/api/v2/master/finance',{headers:{authorization:'Bearer '+token}}),f.env,{});assert.equal(denied.status,401);
 }finally{f.db.close();}
});
test('generated Apps Script is valid, skips historic responses, and creates trigger-driven processing with durable retries',()=>{
 const source=appsScriptSource({...BRIEF_SOURCE,endpoint:'https://test.local/api/v2/brief-intake'});assert.doesNotThrow(()=>new vm.Script(source));assert.ok(source.includes('sheet.getLastRow() + 1')||source.includes('sheet.getLastRow()+1'));assert.match(source,/onFormSubmit\(\)/);assert.match(source,/everyMinutes\(5\)/);assert.match(source,/lock.releaseLock/);assert.ok(!source.includes(token));
 const profile=normalizeBrief(body({headers:[...body().headers,'Название проекта'],values:[...body().values,'Synthetic Brand']})).profile;assert.equal(profile.name,'Synthetic Brand');assert.equal(profile.nameConfirmed,true);
});
test('Apps Script cursor never advances past a failed folder or row and retries the same row before later responses',()=>{
 const props=new Map([['TOYS_NEXT_BRIEF_ROW','3']]),rows=[['Timestamp','Product'],[new Date('2026-10-01'),'old'],[new Date('2026-10-27'),'new'],[new Date('2026-10-28'),'next']];
 const sheet={getSheetId:()=>BRIEF_SOURCE.sheetId,getLastColumn:()=>2,getLastRow:()=>4,getRange:row=>({getDisplayValues:()=>[rows[row-1]],getValues:()=>[rows[row-1]]})};
 const properties={getProperty:key=>props.get(key)??null,setProperty:(key,value)=>props.set(key,value),deleteProperty:key=>props.delete(key)};
 const context={Date,SpreadsheetApp:{openById:()=>({getSheets:()=>[sheet]})},PropertiesService:{getScriptProperties:()=>properties},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})}};
 vm.createContext(context);vm.runInContext(appsScriptSource({...BRIEF_SOURCE,endpoint:'https://test.local'}),context);
 const processed=[];context.toysSubmitRow=row=>{processed.push(row);throw new Error('brief_folder_unavailable');};assert.throws(()=>context.toysProcessBriefs());assert.equal(props.get('TOYS_NEXT_BRIEF_ROW'),'3');assert.deepEqual(processed,[3]);
 context.toysSubmitRow=row=>processed.push(row);context.toysProcessBriefs();assert.equal(props.get('TOYS_NEXT_BRIEF_ROW'),'5');assert.deepEqual(processed,[3,3,4]);assert.equal(props.has('TOYS_LAST_ERROR'),false);
});
