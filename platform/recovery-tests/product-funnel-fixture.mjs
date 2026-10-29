import {execFileSync} from 'node:child_process';
import {saveAdsSnapshot} from '../imports/ads-store.js';
export async function seedProductFunnel(env,db){
 const seed=JSON.parse(execFileSync('node',['scripts/tyver-project-seed.mjs'],{encoding:'utf8'}));for(const q of seed.statements)db.prepare(q.sql).run(...q.params);
 Object.assign(env,{DIRECT_ADS_READ_ENABLED:'true'});
 const id=seed.id,integrationId='test-tyver-meta',scope={organizationId:'org_toys_agency',projectId:id,integrationId,provider:'meta_ads',accountId:'123456',timezone:'UTC',currency:'EUR'};
 db.prepare("INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES(?,?,'meta_ads','123456','active',?)").run(integrationId,id,JSON.stringify({source:'managed_meta',accountTimezone:'UTC',expectedCurrency:'EUR',productFunnel:true}));
 for(const who of ['team','client'])db.prepare('INSERT INTO project_memberships(project_id,user_id,role) VALUES(?,?,?)').run(id,'role-'+who,who==='team'?'buyer':'client_viewer');
 const number=v=>({value:String(v),state:'observed'}),day='2026-10-28';
 const ad=(id,landing,spend,clicks,leads,registrations,trials)=>({level:'ad',providerId:id,name:'Synthetic '+landing,children:[],funnelDimensions:{language:id==='1'||id==='2'?'en':'ru',geo:id==='3'?'EU':id==='4'?'CIS':'unknown',geoBasis:'campaign_name',landing,landingBasis:'creative_url'},dailyMetrics:[{date:day,metrics:{impressions:number(clicks*10),clicks:number(clicks),spend:number(spend),conversions:number(leads)}}],outcomeDaily:[{date:day,metrics:Object.fromEntries(Object.entries({landingViews:clicks-5,leads,registrations,trials,purchases:1,purchaseValue:20}).map(([k,v])=>[k,number(v)]))}]});
 const campaigns=[['c1','Synthetic / Main / eng',[ad('1','quiz',100,100,10,20,4),ad('2','warp',50,50,20,10,1)]],['c2','Synthetic / EU / ru',[ad('3','quiz',200,100,20,10,1)]],['c3','Synthetic / CIS / ru',[ad('4','warp',50,100,10,15,3)]]].map(([id,name,ads])=>({level:'campaign',providerId:id,name,children:[{level:'group',providerId:'g-'+id,children:ads,dailyMetrics:[]}],dailyMetrics:[]}));
 const payload={schemaVersion:'ads-hierarchy/1',provider:'meta_ads',integrationId,coverage:'complete',requestedRange:{from:day,to:day},fetchedAt:new Date().toISOString(),hierarchy:{level:'account',providerId:scope.accountId,timezone:'UTC',currency:'EUR',children:campaigns,dailyMetrics:[]}};
 await saveAdsSnapshot(env.TOYS_DB,scope,payload);return {scope,payload,seed};
}
