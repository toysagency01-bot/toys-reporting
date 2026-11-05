import {valueOf} from '../unified/model.js';

export function instashopAdvertising(rows,{facts=[],exchangeRates=[],knownRates=new Map(),accountName='PROFKIT'}={}){
 const ratios=new Map();
 for(const f of facts){const usd=valueOf(f.metrics?.find(m=>m.metricCode==='ads.raw_spend_usd')),uah=valueOf(f.metrics?.find(m=>m.metricCode==='ads.spend_uah'));if(usd>0&&uah!=null){if(!ratios.has(f.date))ratios.set(f.date,[]);ratios.get(f.date).push(uah/usd);}}
 for(const [date,values]of ratios)if(!knownRates.has(date)&&Math.max(...values)-Math.min(...values)<=.01)knownRates.set(date,values[0]);
 for(const r of exchangeRates)if(Number(r.rate)>0)knownRates.set(r.date,Number(r.rate));
 const missingFxDates=[];
 const mapped=rows.map(r=>{
  let spend=r.spend,usd=null;if(r.currency==='USD'){usd=spend;const rate=knownRates.get(r.date);if(spend!==0&&!rate)missingFxDates.push(r.date);spend=spend===0?0:spend==null||!rate?null:spend*rate;}else if(r.currency!=='UAH')return null;
  return {date:r.date,platform:'Meta Ads',account:accountName,accountId:r.integrationId||'',currency:'UAH',campaign:r.name,impressions:r.impressions,clicks:r.clicks,spendUah:spend,metaDirect:r.conversions,spendUsd:usd,fx:usd>0&&spend!=null?spend/usd:null};
 });
 return {rows:mapped,missingFxDates:[...new Set(missingFxDates)]};
}
