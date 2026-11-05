import {buildImportSql} from '../scripts/build-housevip-mvp-import.mjs';
import {saveAdsSnapshot} from '../imports/ads-store.js';
export async function seedManualLeads(env,db){
 db.exec("INSERT INTO projects(id,organization_id,slug,name,project_type,status,currency,timezone,client_id,capabilities_json,active_preset) VALUES('prj_murmur_up8m','org_toys_agency','murmur-up8m','MurMur','leadgen','active','CZK','Europe/Prague','client_housevip','[\"ads\",\"content\",\"period_reports\"]','leadgen')");
 const snapshot={schema_version:'housevip-pilot-snapshot/1.0',generated_at:'2026-11-05T10:00:00.000Z',project:'HOUSEVIP',requested_window:{start:'2026-11-04',end:'2026-11-04',timezone:'Europe/Prague'},privacy:{includes_personal_lead_or_contact_rows:false,includes_secrets:false},ad_rows:[{date:'2026-11-04',platform:'Meta Ads',currency:'CZK',campaign:'Synthetic campaign',impressions:100,clicks:20,cost:1000,conversions:5,conv_value:0,source_tab:'MetaAds',source_row:2}],aggregates:{control_totals_by_currency:[{currency:'CZK',impressions:100,clicks:20,cost:1000,conversions:5,conv_value:0}]},coverage:{observed_min:'2026-11-04',observed_max:'2026-11-04',available_rows:1,missing_days_are_not_zero:true}};
 // Reuse the existing synthetic baseline builder, then namespace its SQL for
 // this fixture. Production project data never enters this helper.
 const template=structuredClone(snapshot);template.requested_window.timezone='Asia/Tbilisi';template.ad_rows[0].currency='IDR';template.aggregates.control_totals_by_currency[0].currency='IDR';
 db.exec(buildImportSql(template).sql.replaceAll('prj_housevip_cxp7','prj_murmur_up8m').replaceAll('housevip','murmur').replaceAll('IDR','CZK').replaceAll('Asia/Tbilisi','Europe/Prague'));
 db.exec(`INSERT INTO dashboard_config_revisions(id,organization_id,project_id,revision_number,schema_version,preset,config_json,status) VALUES('cfg_murmur_1','org_toys_agency','prj_murmur_up8m',1,'toys-dashboard-config/1.0','leadgen','{"defaultView":"metrics","panels":["spend","impressions","clicks","ctr","reportedConversions","cpa"],"currencyPolicy":"native"}','published');
 INSERT INTO dashboard_config_pointers(organization_id,project_id,revision_id) VALUES('org_toys_agency','prj_murmur_up8m','cfg_murmur_1');`);
 db.prepare("INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES('int_murmur_meta','prj_murmur_up8m','meta_ads','844818919266098','active',?)").run(JSON.stringify({expectedCurrency:'CZK',accountTimezone:'Europe/Prague'}));
 const m=value=>({value:String(value),state:'observed'}),daily={date:'2026-11-04',metrics:{impressions:m(100),clicks:m(20),spend:m(1000),conversions:m(5)}};
 const scope={projectId:'prj_murmur_up8m',projectSlug:'murmur-up8m',organizationId:'org_toys_agency',integrationId:'int_murmur_meta',provider:'meta_ads',accountId:'844818919266098',timezone:'Europe/Prague',currency:'CZK'};
 await saveAdsSnapshot(env.TOYS_DB,scope,{schemaVersion:'ads-hierarchy/1.0',integrationId:scope.integrationId,provider:'meta_ads',coverage:'complete',requestedRange:{from:'2026-10-30',to:'2026-11-05'},fetchedAt:new Date().toISOString(),hierarchy:{providerId:scope.accountId,level:'account',currency:'CZK',timezone:'Europe/Prague',dailyMetrics:[daily],children:[{providerId:'123',name:'Synthetic campaign',level:'campaign',dailyMetrics:[daily],children:[]}]}});
 env.DIRECT_ADS_READ_ENABLED='true';env.MVP_EDITOR_PROJECTS+=',murmur-up8m';env.MVP_VIEW_PROJECTS+=',murmur-up8m';
 return scope;
}
