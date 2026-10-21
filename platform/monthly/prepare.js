import {createHash} from 'node:crypto';
import {nodeTotals} from '../unified/model.js';
import {advertisingFields,businessFields} from './model.js';
// A report is a saved snapshot. Reading/creating one never calls an ad provider.
export async function prepareMonthlyRows(env,projectId,from,to){
 const records=(await env.TOYS_DB.prepare(`SELECT payload_json,local_date,checked_at,integration_id FROM (SELECT d.*,ROW_NUMBER() OVER(PARTITION BY d.integration_id,d.local_date ORDER BY d.checked_at DESC) AS position FROM ads_daily_snapshots d JOIN integrations i ON i.id=d.integration_id AND i.project_id=d.project_id WHERE d.project_id=? AND d.local_date BETWEEN ? AND ? AND i.status='active') WHERE position=1 ORDER BY local_date`).bind(projectId,from,to).all()).results;
 const campaigns=new Map(),covered=new Set();let latest=null,foreignCurrency=false;
 for(const record of records){const payload=JSON.parse(record.payload_json);if(payload.hierarchy?.currency!=='CZK'){foreignCurrency=true;continue;}covered.add(record.local_date);if(!latest||record.checked_at>latest)latest=record.checked_at;
  for(const node of payload.hierarchy.children||[]){const id='campaign-'+createHash('sha256').update(record.integration_id+':'+node.providerId).digest('hex').slice(0,24);const existing=campaigns.get(id)||{id,name:node.name||'Кампания',dailyMetrics:[]};existing.dailyMetrics.push(...node.dailyMetrics||[]);existing.name=node.name||existing.name;campaigns.set(id,existing);}
 }
 let rows=[...campaigns.values()].map(node=>{const totals=nodeTotals(node,{from,to});return {id:node.id,name:node.name,spend:totals.spend,clicks:totals.clicks,leads:Number.isInteger(totals.conversions)?totals.conversions:null,reach:null,linkClicks:null,socialClicks:null,appointments:null,patients:null,revenue:null,unconfirmed:{}};});
 if(!rows.length){const previous=await env.TOYS_DB.prepare('SELECT campaigns_json FROM project_monthly_reports WHERE project_id=? ORDER BY period_end DESC LIMIT 1').bind(projectId).first();rows=(previous?JSON.parse(previous.campaigns_json):[]).map(r=>({id:r.id,name:r.name,...Object.fromEntries([...advertisingFields,...businessFields].map(k=>[k,null])),unconfirmed:{}}));}
 if(!rows.length)throw Object.assign(new Error('monthly_no_campaigns'),{code:'monthly_no_campaigns',status:409});
 return {rows,source:{kind:'saved_advertising',coveredDates:[...covered].sort(),lastUpdatedAt:latest,foreignCurrency,advertisingNeedsReview:true}};
}
