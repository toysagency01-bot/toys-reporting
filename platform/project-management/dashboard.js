// Managed dashboards exist before the first provider import. Missing data is
// explicit; channel/currency facts appear only after an accepted source import.
export async function managedDashboard(env,p,url,auth){
 const row=await env.TOYS_DB.prepare('SELECT setup_json FROM project_setup_state WHERE project_id=?').bind(p.id).first();if(!row)return null;
 const setup=JSON.parse(row.setup_json),today=new Intl.DateTimeFormat('en-CA',{timeZone:setup.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const from=url.searchParams.get('from')||new Date(Date.parse(today)-6*86400000).toISOString().slice(0,10),toExclusive=url.searchParams.get('toExclusive')||new Date(Date.parse(today)+86400000).toISOString().slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(toExclusive)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(toExclusive))||from>=toExclusive)return Response.json({ok:false,error:'invalid_range'},{status:400});
 const stored=(await env.TOYS_DB.prepare('SELECT * FROM project_setup_ad_rows WHERE project_id=? AND metric_date>=? AND metric_date<? ORDER BY metric_date,campaign_key').bind(p.id,from,toExclusive).all()).results||[];
 const channels={};for(const channel of setup.channels.filter(c=>c!=='smm')){
  const rows=stored.filter(r=>r.provider===(channel==='google'?'google_ads':'meta_ads')).map(r=>({date:r.metric_date,campaign:{ref:r.campaign_key,label:r.campaign_name},metrics:[['ads.impressions',r.impressions,'count',null],['ads.clicks',r.clicks,'count',null],['ads.spend',r.spend,'money',r.currency],['ads.reported_conversions',r.conversions,'count',null]].map(([metricCode,value,unit,currency])=>({metricCode,valueText:value==null?null:String(value),value:value==null?null:String(value),state:value==null?'missing':'observed',valueState:value==null?'missing':'observed',unit,currency}))}));
  channels[channel]={grain:'campaign_daily',rows,coverage:{availability:rows.length?'available':'not_configured',status:rows.length?'partial':'unknown',rowCount:rows.length}};
 }
 return Response.json({ok:true,dashboard:{schemaVersion:'toys-dashboard/2.0',access:{role:auth.role},project:{id:p.id,slug:p.slug,name:p.name,preset:setup.type,reportingTimezone:setup.timezone,locale:'ru',goals:{...setup.kpi,currency:setup.currency}},range:{from,toExclusive},coverage:{availability:stored.length?'available':'not_configured',status:stored.length?'partial':'unknown',rowCount:stored.length,warning:stored.length?'Google: импортированный CSV. Для обновления загрузите новую выгрузку.':'Рекламные источники ещё не передали данные.'},panels:[],advertising:{channels,currencyPolicy:{mode:'native_separate',additive:false}},...(setup.type==='ecommerce'?{ecommerce:{account:{rows:[]},campaigns:{rows:[]}}}:{})}},{headers:{'cache-control':'private, no-store'}});
}
export async function managedBrowserProject(env,slug){
 const row=await env.TOYS_DB.prepare("SELECT settings_json FROM projects WHERE slug=? AND status='active' AND organization_id='org_toys_agency' AND json_extract(settings_json,'$.managedProject')=1").bind(slug).first();return row?JSON.parse(row.settings_json).browserProject:null;
}
