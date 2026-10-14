// Published multi-channel lead generation history; rows come only from sealed D1 generations.
export async function leadgenDashboard(env,project,release,manifest,url,auth,helpers){
 const {generationRecord,factRows,aggregateMetric,derivedMetric,effectiveFreshness,response}=helpers;
 const descriptors=manifest.datasets||[],seen=new Set(),sources=[];
 for(const d of descriptors){
  const channel=d.channelKey||d.channel;
  if(!['meta','google'].includes(channel)||seen.has(channel)||d.grain!=='campaign_daily')return response({ok:false,error:'invalid_leadgen_release'},500);
  seen.add(channel);const g=await generationRecord(env,project,d.generationId);
  if(!g||g.sourceStreamId!==d.sourceStreamId||g.channel!==channel||g.sourceGrain!==d.grain)return response({ok:false,error:'release_generation_missing'},500);
  sources.push({channel,g});
 }
 if(!sources.length)return response({ok:false,error:'release_generation_missing'},500);
 const from=url.searchParams.get('from')||sources.map(s=>s.g.observedFrom||s.g.requestedFrom).filter(Boolean).sort()[0];
 const toExclusive=url.searchParams.get('toExclusive')||sources.map(s=>s.g.observedToExclusive||s.g.requestedToExclusive).filter(Boolean).sort().at(-1);
 const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if(!valid(from)||!valid(toExclusive)||from>=toExclusive)return response({ok:false,error:'invalid_range'},400);
 const selected=url.searchParams.get('channel');
 if(selected&&selected!=='all'&&!seen.has(selected))return response({ok:false,error:'incompatible_filter',reason:'channel_not_in_release'},400);
 if(url.searchParams.has('accountRef'))return response({ok:false,error:'incompatible_filter',reason:'account_filter_unsupported'},400);
 const channels={};
 for(const {channel,g}of sources){
  if(selected&&selected!=='all'&&selected!==channel)continue;
  let rows=(await factRows(env,project,g.id)).filter(r=>r.date>=from&&r.date<toExclusive);
  const campaign=url.searchParams.get('campaignRef');if(campaign)rows=rows.filter(r=>r.campaign.ref===campaign);
  channels[channel]={grain:'campaign_daily',rows,coverage:{availability:g.availability,status:g.coverage,freshness:effectiveFreshness(g,env.MVP_AS_OF_DATE),requested:{from:g.requestedFrom,toExclusive:g.requestedToExclusive},observed:{from:g.observedFrom,toExclusive:g.observedToExclusive},rowCount:rows.length}};
 }
 const rows=Object.values(channels).flatMap(s=>s.rows),currencies=[...new Set(rows.flatMap(r=>r.metrics.filter(m=>m.metricCode==='ads.spend').map(m=>m.currency)).filter(Boolean))];
 const impressions=aggregateMetric(rows,'ads.impressions'),clicks=aggregateMetric(rows,'ads.clicks'),conversions=aggregateMetric(rows,'ads.reported_conversions');
 const panels=[impressions,clicks,conversions,derivedMetric('ads.ctr',clicks,impressions,'100')];
 for(const currency of currencies){const nativeRows=rows.filter(r=>r.metrics.some(m=>m.metricCode==='ads.spend'&&m.currency===currency)),spend=aggregateMetric(nativeRows,'ads.spend');panels.push(spend,{...derivedMetric('ads.cpa',spend,aggregateMetric(nativeRows,'ads.reported_conversions')),currency});}
 const coverages=Object.values(channels).map(s=>s.coverage),coverage={availability:'available',status:coverages.every(c=>c.status==='complete')?'complete':'partial',freshness:coverages.every(c=>c.freshness==='fresh')?'fresh':'stale',requested:{from,toExclusive},observed:{from,toExclusive},rowCount:rows.length};
 const publicMetrics=new Set(['ads.impressions','ads.clicks','ads.spend','ads.reported_conversions','ads.reported_conversion_value']);
 if(auth.role==='public')for(const d of Object.values(channels))d.rows=d.rows.map(r=>({date:r.date,campaign:{label:r.campaign.label},metrics:r.metrics.filter(m=>publicMetrics.has(m.metricCode)).map(({metricCode,value,unit,currency,state})=>({metricCode,value,unit,currency,state}))}));
 return response({ok:true,dashboard:{schemaVersion:'toys-dashboard/2.0',access:{role:auth.role},project:{slug:project.slug,name:project.name,reportingTimezone:project.timezone,locale:project.defaultLocale},range:{from,toExclusive},coverage,panels,advertising:{channels,currencyPolicy:{mode:'native_separate',additive:false}},...(auth.role==='public'?{}:{configRevision:{id:project.configRevisionId,revision:project.configRevision},dataReleaseRef:{id:release.id,revision:release.revision,sourceHash:release.sourceHash}})}});
}
