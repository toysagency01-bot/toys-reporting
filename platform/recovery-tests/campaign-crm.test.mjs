import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignIndex,campaignPage,campaignDataset} from '../native/campaign-model.js';
import {datasetPage} from '../native/campaign-dataset.js';
import {attachCampaignQualifications} from '../native/campaign-crm.js';
import {keyCRMCampaign} from '../crm/keycrm-campaigns.js';
import {campaignAPI} from '../native/campaign-api.js';
import {fixture,request} from './fixture.mjs';
import {enable,updateLead} from '../crm/service.js';
const range={from:'2026-10-10',to:'2026-10-10'},m=value=>({value:String(value),state:'observed'});
const daily=()=>[{date:range.from,metrics:{spend:m(120),impressions:m(100),clicks:m(20),conversions:m(13)}}];
const provider=(account='123')=>({provider:'meta_ads',integrationId:account,requestedRange:range,hierarchy:{providerId:account,currency:'PLN',children:[{level:'campaign',providerId:'1',name:'Consultations',dailyMetrics:daily(),children:[{level:'group',providerId:'2',dailyMetrics:daily(),children:[{level:'ad',providerId:'3',dailyMetrics:daily(),children:[]}]}]}]}});
const native={available:true,qualified:2,byAd:[{provider:'meta_ads',accountId:'act_123',adId:'3',qualified:2}]};
test('campaign CRM uses intake qualifications, exact account scope and one sum at each alternative level',()=>{
 const tree=campaignIndex('project',[provider(),provider('456')],range),context=attachCampaignQualifications(tree,native,range);
 assert.equal(context.matched,2);assert.equal(context.unmatched,0);
 for(const e of tree.index.values()){
  const page=campaignPage({tree,range,parent:e.node.level==='ad'?'':e.key});
  const value=Number(e.node.crmQualifiedLeads.value);assert.equal(value,e.provider.hierarchy.providerId==='123'?2:0);assert.ok(page);
 }
 const page=campaignPage({tree,range}),matched=page.rows.find(r=>r.metrics.qualifiedLeads===2),empty=page.rows.find(r=>r.metrics.qualifiedLeads===0);assert.equal(matched.metrics.cpql,60);assert.equal(empty.metrics.cpql,null);
 const dataset=campaignDataset(tree,[],range);assert.deepEqual(datasetPage(dataset,{sort:'cpql'}),campaignPage({tree,range,sort:'cpql'}));
});
test('KeyCRM campaign-only attribution never fabricates ad counts or assigns unmatched qualifications',()=>{
 const tree=campaignIndex('project',[provider(),provider('456')],range);
 const crm={available:true,source:'keycrm',qualified:5,campaignAttributionAvailable:true,byCampaign:[{provider:'meta_ads',accountId:'123',campaignId:'1',qualified:2}],byAd:[]};
 const context=attachCampaignQualifications(tree,crm,range);assert.equal(context.status,'partial');assert.equal(context.unmatched,3);
 const page=campaignPage({tree,range});assert.equal(page.rows.find(r=>r.metrics.qualifiedLeads===2).metrics.cpql,60);assert.equal(page.rows.filter(r=>r.metrics.qualifiedLeads===null).length,1);
 for(const e of tree.index.values())if(e.node.level!=='campaign')assert.equal(e.node.crmQualifiedLeads,undefined);
 attachCampaignQualifications(tree,{...crm,campaignAttributionAvailable:false},range);assert.equal(campaignPage({tree,range}).rows[0].metrics.qualifiedLeads,null);
 attachCampaignQualifications(tree,{available:false,restricted:true},range);assert.ok([...tree.index.values()].every(e=>!e.node.crmQualifiedLeads));
});
test('ambiguous advertising branches and inconsistent adapter totals fail closed',()=>{
 const tree=campaignIndex('project',[provider(),{...provider(),integrationId:'duplicate'}],range);
 assert.equal(attachCampaignQualifications(tree,native,range).matched,0);
 const single=campaignIndex('project',[provider()],range);
 assert.equal(attachCampaignQualifications(single,{...native,qualified:1},range).status,'unavailable');
 assert.ok([...single.index.values()].every(e=>!e.node.crmQualifiedLeads));
});
test('partial advertising coverage cannot turn partial spend into a full-period CRM qualification cost',()=>{
 const p={...provider(),coverage:'partial'},tree=campaignIndex('project',[p],range);
 attachCampaignQualifications(tree,native,range);const row=campaignPage({tree,range}).rows[0];assert.equal(row.metrics.qualifiedLeads,2);assert.equal(row.metrics.cpql,null);
});
test('KeyCRM utm_campaign matches only an exact unique owned ID or campaign name and persists no raw tags',()=>{
 const campaign={provider:'meta_ads',accountId:'123',campaignId:'456',name:'TOYS / Consultation'},card={utm_source:'toys',utm_campaign:'456'};
 for(const value of ['456',campaign.name])assert.deepEqual(keyCRMCampaign({...card,utm_campaign:value},[campaign,campaign]),{attributionState:'matched',campaignProvider:'meta_ads',campaignAccountId:'123',campaignId:'456'});
 assert.equal(keyCRMCampaign(card,[campaign,{...campaign,accountId:'999'}]).attributionState,'ambiguous_campaign');
 assert.equal(keyCRMCampaign({...card,utm_source:'other'},[campaign]).attributionState,'foreign_source');
 assert.equal(keyCRMCampaign({...card,utm_campaign:null},[campaign]).attributionState,'missing_campaign');
 for(const value of [' 456','456|123','{{campaign.id}}','private@example.test']){const result=keyCRMCampaign({...card,utm_campaign:value},[campaign]);assert.equal(result.attributionState,'unknown_campaign');assert.ok(!JSON.stringify(result).includes(value));}
});
test('campaign API automatically enables CRM metrics and honours CRM administrator restrictions',async()=>{
 const {db,env}=fixture(),project={id:'prj_housevip_cxp7',slug:'housevip-cxp7',organizationId:'org_toys_agency'};
 try{
  await enable(env,project);
  db.prepare("INSERT INTO leads(id,project_id,source_provider,external_lead_id,created_at,name,current_status,metadata_json) VALUES('private-lead',?,'manual','synthetic','2026-10-10T09:00:00Z','Private name','Новый',?)").run(project.id,JSON.stringify({adAttribution:{version:1,provider:'meta_ads',accountId:'123',adId:'3'}}));
  await updateLead(env,project,'private-lead',{status:'Квалифицирован',version:0},'synthetic','qualified');
  const deps={authorizeMvp:async()=>({ok:true}),projectRecord:async()=>project,onDemandAdsService:()=>({getStats:async()=>({providers:[provider()]})}),backend:{fetch:async()=>Response.json({ok:true,dashboard:{facts:{rows:[]}}})}};
  const url='/api/v2/projects/housevip-cxp7/campaign-browser?'+new URLSearchParams({...range,dataset:'1'});
  let result=await(await campaignAPI(request(url),env,{},deps)).json();assert.equal(result.ok,true);assert.equal(result.crmQualification.enabled,true);assert.equal(result.rows[0].metrics.qualifiedLeads,1);assert.equal(result.rows[0].metrics.cpql,120);assert.equal(result.dataset.rows[2].metrics.qualifiedLeads,1);assert.ok(!JSON.stringify(result).includes('Private name'));assert.ok(!JSON.stringify(result).includes('private-lead'));
  db.exec("UPDATE crm_projects SET access_mode='admin'");
  result=await(await campaignAPI(request(url),env,{},deps)).json();assert.equal(result.crmQualification.enabled,false);assert.equal(result.rows[0].metrics.qualifiedLeads,null);
 }finally{db.close();}
});
