import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';import {listLeads,updateLead} from '../crm/service.js';
test('board counts every lead, caps each column, pages without loss, persists moves and escapes search',async()=>{
 const {db,env}=fixture(),p={id:'prj_housevip_cxp7'};
 try{
  const insert=db.prepare("INSERT INTO leads(id,project_id,source_provider,external_lead_id,created_at,name,email,current_status) VALUES(?,?,'manual',?,'2026-10-13T10:00:00Z',?,?,'Новый')");
  for(let i=0;i<106;i++)insert.run('lead-'+String(i).padStart(3,'0'),p.id,'source-'+i,i===0?'Literal %_ name':'Synthetic '+i,`lead${i}@example.test`);
  const url=new URL('https://test.local/?view=board');let data=await listLeads(env,p,url);assert.equal(data.total,106);assert.equal(data.columns[0].leads.length,25);assert.equal(data.columns[0].hasMore,true);assert.equal(data.columns[0].total,106);assert.equal(data.columns.length,6);
  const ids=data.columns[0].leads.map(l=>l.id);for(const offset of [25,75]){const next=await listLeads(env,p,new URL('https://test.local/?status='+encodeURIComponent('Новый')+'&offset='+offset));ids.push(...next.leads.map(l=>l.id));}assert.equal(new Set(ids).size,106);assert.equal(ids.length,106);
  await updateLead(env,p,'lead-000',{status:'В работе',version:0},'owner','move');data=await listLeads(env,p,url);assert.equal(data.columns[0].total,105);assert.equal(data.columns[1].total,1);assert.equal(data.columns[1].leads[0].version,1);
  url.searchParams.set('q','%_');data=await listLeads(env,p,url);assert.equal(data.total,1);assert.equal(data.columns[1].leads[0].name,'Literal %_ name');
  await assert.rejects(updateLead(env,p,'lead-000',{status:'Продажа',version:1},'owner','sale'),{code:'sale_value_currency_required'});
 }finally{db.close();}
});
