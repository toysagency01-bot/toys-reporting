import test from 'node:test';import assert from 'node:assert/strict';
import {pipelineFromSettings,statusExpression} from '../crm/pipelines.js';
import {fixture} from './fixture.mjs';
import {listLeads,updateLead} from '../crm/service.js';
test('automotive legacy statuses retain sale semantics and general projects retain their workflow',async()=>{
 const {db,env}=fixture(),p={id:'prj_housevip_cxp7',settingsJson:JSON.stringify({crmTemplate:'automotive'})};
 const pipeline=pipelineFromSettings({crmTemplate:'automotive'});assert.equal(pipeline.stages.length,13);assert.equal(pipeline.stages.find(s=>s.kind==='sale').label,'Завершён');assert.equal(pipelineFromSettings({}).key,'general');
 db.prepare("INSERT INTO leads(id,project_id,source_provider,external_lead_id,created_at,current_status,name) VALUES('test-auto',?,'fixture','test-auto','2026-10-10T08:00:00Z','Работа завершена','Fixture')").run(p.id);
 const before=await listLeads(env,p,new URL('https://test.local/?view=board'));assert.equal(before.summary.sales,1);assert.equal(before.columns.find(c=>c.status==='Завершён').leads.length,1);
 await updateLead(env,p,'test-auto',{version:0,status:'Смета отправлена'},'fixture','fixture-auto-update');
 const after=await listLeads(env,p,new URL('https://test.local/?view=board'));assert.equal(after.summary.sales,0);assert.equal(after.summary.qualified,1);
 db.close();
});
