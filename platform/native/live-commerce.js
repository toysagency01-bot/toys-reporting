import {valueOf} from '../unified/model.js';
// Income and spend must describe the same provider period; update commerce
// together with advertising rather than combining old income with today's cost.
export function liveCommerce(providers,range){
 const account=[],campaigns=[],completeProviders=[];
 for(const p of providers||[]){
  if(p.provider!=='meta_ads'||!p.hierarchy||p.requestedRange?.from!==range.from||p.requestedRange?.to!==range.to)continue;
  const daily=new Map(),campaignRows=[];let valid=true;
  for(const c of p.hierarchy.children||[]){const values=new Map();for(const g of c.children||[])for(const ad of g.children||[])for(const d of ad.outcomeDaily||[]){if(d.date<range.from||d.date>range.to)continue;
   const metrics=Object.fromEntries(['purchases','purchaseValue','addToCart','checkout'].map(k=>[k,valueOf(d.metrics?.[k])]));if(metrics.purchases===null||metrics.purchaseValue===null)valid=false;
   for(const target of [values,daily]){const acc=target.get(d.date)||{purchases:0,purchaseValue:0,addToCart:0,checkout:0};for(const[k,v]of Object.entries(metrics))acc[k]=acc[k]===null||v===null?null:acc[k]+v;target.set(d.date,acc);}
  }
  for(const[date,metrics]of values)campaignRows.push({date,metrics,campaign:{providerCampaignId:c.providerId,label:c.name}});
  if((c.dailyMetrics||[]).some(d=>d.date>=range.from&&d.date<=range.to&&!values.has(d.date)))valid=false;
  }
  if(!valid)continue;
  const row=r=>({...r,platform:'Meta Ads',metrics:Object.entries(r.metrics).map(([key,value])=>({metricCode:({purchases:'ecom.purchases',purchaseValue:'ecom.purchase_value',addToCart:'ecom.add_to_cart',checkout:'ecom.checkout'})[key],value:value===null?null:String(value),state:value===null?'unsupported':'observed',currency:key==='purchaseValue'?p.hierarchy.currency:null}))});
  account.push(...[...daily].map(([date,metrics])=>row({date,metrics})));campaigns.push(...campaignRows.map(row));completeProviders.push(p.provider);
 }
 return {account,campaigns,completeProviders};
}
