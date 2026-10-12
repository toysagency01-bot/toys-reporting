import {dates,shift} from './ads-store.js';
export async function refreshUsdUah(env,{fetchImpl=fetch,now=new Date()}={}){
 const to=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),from=shift(to,-29);
 const stored=(await env.TOYS_DB.prepare("SELECT rate_date FROM exchange_rates WHERE base_currency='USD' AND quote_currency='UAH' AND rate_date>=? AND rate_date<=?").bind(from,to).all()).results||[];
 const present=new Set(stored.map(r=>r.rate_date)),missing=dates(from,to).filter(d=>!present.has(d)).reverse().slice(0,5);
 for(const date of missing){
  const response=await fetchImpl('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&date='+date.replaceAll('-','')+'&json',{signal:AbortSignal.timeout(10000),redirect:'manual'});
  if(!response.ok)throw new Error('NBU rate unavailable');
  const data=await response.json(),rate=Array.isArray(data)&&data.find(r=>r.cc==='USD'&&r.exchangedate===date.split('-').reverse().join('.'));
  if(!rate||!Number.isFinite(rate.rate)||rate.rate<=0)throw new Error('NBU daily rate invalid');
  await env.TOYS_DB.prepare("INSERT OR IGNORE INTO exchange_rates(rate_date,base_currency,quote_currency,rate,source,fetched_at) VALUES(?,'USD','UAH',?,'NBU API',?)").bind(date,rate.rate,now.toISOString()).run();
 }
}
