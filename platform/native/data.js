import {snapshotRows,valueOf} from '../unified/model.js';
const value=(r,c)=>valueOf((r.metrics||[]).find(m=>m.metricCode===c));
const currency=(r,c)=>(r.metrics||[]).find(m=>m.metricCode===c)?.currency||'';
const grid=(labels,rows)=>({status:'ok',table:{cols:labels.map(label=>({label,type:label==='date'?'date':'string'})),rows:rows.map(values=>({c:values.map(v=>({v}))}))}});
const metricCodes={qualified_inquiries:'instashop.qualified_inquiries',unqualified_inquiries:'instashop.unqualified_inquiries',direct_inquiries:'instashop.direct_inquiries',sales:'instashop.sales_count',revenue_uah:'instashop.revenue_uah'};
export function sourceTable(dashboard,name){
 const title=dashboard.project?.name||'',metrics=dashboard.instashop?.ads?.rows||[];
 if(name==='MetaAds'||name==='GoogleAds'){
  const provider=name==='GoogleAds'?'google_ads':'meta_ads';
  const labels=['date','platform','account_name','account_id','currency','campaign','impressions','clicks','cost','conversions','conv_value','spend_usd','meta_direct_inquiries'];
  return grid(labels,snapshotRows(dashboard).filter(r=>r.provider===provider).map(r=>{
   const original=metrics.find(m=>m.date===r.date&&(m.campaign?.ref||m.campaign?.label)===(r.campaignId||r.name));
   return[r.date,provider==='google_ads'?'Google Ads':'Meta Ads',title,r.accountRef||'',r.currency,r.name,r.impressions,r.clicks,r.spend,r.conversions,null,original?value(original,'ads.raw_spend_usd'):null,r.conversions];
  }));
 }
 if(name==='InstashopSales')return grid(['date',...Object.keys(metricCodes)],(dashboard.instashop?.sales?.rows||[]).map(r=>[r.date,...Object.values(metricCodes).map(c=>value(r,c))]));
 if(name==='EcomFunnel'||name==='EcomFunnelCampaign'){
  const campaign=name.endsWith('Campaign');const data=campaign?dashboard.ecommerce?.campaigns:dashboard.ecommerce?.account;
  const labels=['date','platform','account_name','account_id','currency',...(campaign?['campaign','campaign_id']:[]),'add_to_cart','add_to_cart_value','checkout','checkout_value','purchase','purchase_value'];
  return grid(labels,(data?.rows||[]).map(r=>[r.date,r.platform||'Источник не указан',title,r.accountRef||'',currency(r,'ecom.purchase_value'),...(campaign?[r.campaign?.label||'',r.campaign?.providerCampaignId||'']:[]),value(r,'ecom.add_to_cart'),value(r,'ecom.add_to_cart_value'),value(r,'ecom.checkout'),value(r,'ecom.checkout_value'),value(r,'ecom.purchases'),value(r,'ecom.purchase_value')]));
 }
 return grid([],[]);
}
export function weeklyTable(reports){const fields=['id','period_start','period_end','summary','wins','issues','changes','next_steps','status','created_at','updated_at'];return grid(fields,reports.map((r,i)=>[String(i),r.periodStart,r.periodEnd,r.summary,r.wins,r.issues,r.changes,r.nextSteps,'published','','']));}
