export function manualLeadRows(counts,providers,advertising,range){
 if(!counts?.entries?.length)return [];
 const rows=advertising.filter(r=>r.source!=='manual_leads'),known=rows.length>0||(providers||[]).some(p=>p.provider==='meta_ads'&&p.hierarchy&&p.coverage==='complete');
 return counts.entries.filter(r=>r.count>0&&r.date>=range.from&&r.date<=range.to).map(r=>({
  date:r.date,provider:'meta_ads',integrationId:'manual-lead-counts',campaignId:'manual-leads',name:'Лиды, добавленные вручную',currency:counts.currency,
  impressions:known?0:null,clicks:known?0:null,spend:known?0:null,conversions:known?r.count:null,
  manualCount:r.count,conversionLabel:'Ручные лиды',source:'manual_leads',children:null
 }));
}
