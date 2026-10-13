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

test('arrival dates use Tbilisi boundaries, including offset timestamps, and apply to counts and pagination',async()=>{
 const {db,env}=fixture(),p={id:'prj_housevip_cxp7'};
 try{
  const insert=db.prepare("INSERT INTO leads(id,project_id,source_provider,external_lead_id,created_at,name,phone,current_status) VALUES(?,?,'manual',?,?,?,'+995555010000','Квалифицирован')");
  const times=['2026-10-12T19:59:59Z','2026-10-12T20:00:00Z','2026-10-13T22:59:59+03:00','2026-10-13T20:00:00Z'];
  for(let i=0;i<times.length;i++)insert.run('boundary-'+i,p.id,'boundary-'+i,times[i],'Boundary '+i);
  for(let i=0;i<30;i++)insert.run('inside-'+i,p.id,'inside-'+i,'2026-10-13T10:00:00Z','Inside '+i);
  const url=new URL('https://test.local/?view=board&from=2026-10-13&to=2026-10-13');
  const d=await listLeads(env,p,url);assert.equal(d.total,32);assert.equal(d.summary.qualified,32);assert.equal(d.columns[2].leads.length,25);assert.equal(d.range.timeZone,'Asia/Tbilisi');
  url.searchParams.delete('view');url.searchParams.set('offset','25');const rest=await listLeads(env,p,url);
  const ids=[...d.columns[2].leads,...rest.leads].map(l=>l.id);assert.equal(new Set(ids).size,32);assert.ok(ids.includes('boundary-1'));assert.ok(ids.includes('boundary-2'));assert.ok(!ids.includes('boundary-0'));assert.ok(!ids.includes('boundary-3'));
  for(const range of ['from=2026-02-30&to=2026-03-01','from=2026-10-13','to=2026-10-13','from=2026-10-14&to=2026-10-13'])await assert.rejects(listLeads(env,p,new URL('https://test.local/?view=board&'+range)),{code:'invalid_range'});
 }finally{db.close();}
});

test('board metrics follow current stages and editable deal amounts, preserving first conversion history',async()=>{
 const {db,env}=fixture(),p={id:'prj_housevip_cxp7'};
 try{
  db.prepare("INSERT INTO leads(id,project_id,source_provider,external_lead_id,created_at,name,current_status) VALUES('deal',?,'manual','deal','2026-09-01T10:00:00Z','Current deal','Новый')").run(p.id);
  const board=()=>listLeads(env,p,new URL('https://test.local/?view=board&from=2026-09-01&to=2026-09-01'));
  let version=0;const move=async(status,extra={})=>updateLead(env,p,'deal',{status,version:version++,...extra},'owner','change-'+version);
  await move('Квалифицирован');assert.deepEqual((await board()).summary,{qualified:1,sales:0,revenue:[]});
  await move('Продажа',{value:'125.50',currency:'EUR'});let d=await board();assert.equal(d.summary.qualified,0);assert.equal(d.summary.sales,1);assert.equal(d.summary.revenue[0].value,125.5);
  await move('Продажа',{value:'250',currency:'USD'});d=await board();assert.equal(d.summary.revenue.length,1);assert.equal(d.summary.revenue[0].value,250);assert.equal(d.summary.revenue[0].currency,'USD');assert.equal(d.columns[3].leads[0].saleValue,'250');
  await move('Потерян');assert.deepEqual((await board()).summary,{qualified:0,sales:0,revenue:[]});
  await move('Квалифицирован');assert.equal((await board()).summary.qualified,1);
  await move('Продажа',{value:'250',currency:'USD'});assert.equal((await board()).summary.sales,1);
  const filtered=await listLeads(env,p,new URL('https://test.local/?view=board&q=nonexistent'));assert.deepEqual(filtered.summary,{qualified:0,sales:0,revenue:[]});
  const currentDay=await listLeads(env,p,new URL('https://test.local/?view=board&from=2026-10-13&to=2026-10-13'));assert.equal(currentDay.total,0);assert.equal(currentDay.summary.sales,0);
  const first=db.prepare("SELECT value,currency FROM crm_milestones WHERE lead_id='deal' AND kind='sale'").get();assert.equal(first.value,'125.50');assert.equal(first.currency,'EUR');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM crm_milestones WHERE lead_id='deal'").get().n,2);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM crm_delivery WHERE lead_id='deal'").get().n,2);
 }finally{db.close();}
});
