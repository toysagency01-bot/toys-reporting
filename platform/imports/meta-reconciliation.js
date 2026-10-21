import {addDecimal} from '../native/google-receiver.js';
import {dates} from './ads-store.js';

const zero=()=>({impressions:'0',clicks:'0',spend:'0',conversions:'0',leads:'0',purchases:'0',purchaseValue:'0',addToCart:'0',checkout:'0'});
const fail=code=>{throw Object.assign(new Error(code),{code});};
function decimal(value){
 if(!/^\d+(?:\.\d+)?$/.test(String(value??'')))fail('account_audit_invalid_metric');
 return addDecimal('0',String(value));
}
function metrics(row,eventKeys){
 const action=(items,keys)=>decimal(keys.map(key=>items?.find(a=>a.action_type===key)?.value).find(v=>v!=null)??'0');
 const purchaseKeys=['omni_purchase','purchase','offsite_conversion.fb_pixel_purchase'];
 return {impressions:decimal(row.impressions),clicks:decimal(row.clicks),spend:decimal(row.spend),
  conversions:action(row.actions,eventKeys),leads:action(row.actions,['lead']),
  purchases:action(row.actions,purchaseKeys),purchaseValue:action(row.action_values,purchaseKeys),
  addToCart:action(row.actions,['omni_add_to_cart','add_to_cart','offsite_conversion.fb_pixel_add_to_cart']),
  checkout:action(row.actions,['omni_initiated_checkout','initiate_checkout','offsite_conversion.fb_pixel_initiate_checkout'])};
}
function sum(target,values){for(const key of Object.keys(target))target[key]=addDecimal(target[key],values[key]);return target;}
function subtract(left,right){
 const scale=Math.max(left.split('.')[1]?.length||0,right.split('.')[1]?.length||0);
 const integer=s=>{const[a,b='']=s.split('.');return BigInt(a+b.padEnd(scale,'0'));};
 const n=integer(left)-integer(right),digits=(n<0n?-n:n).toString().padStart(scale+1,'0');
 return (n<0n?'-':'')+addDecimal('0',scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits);
}

// Independent account-level API response, compared only on completed local days.
// This checks API arithmetic, not an unobserved user's Ads Manager column setup.
export async function reconcileMetaAccount({fetchPage,adRows,eventKeys,scope,dailyFallback=false}){
 if(!eventKeys?.length)fail('account_audit_mapping_missing');
 const expected=new Map(dates(scope.from,scope.to).map(date=>[date,zero()]));
 for(const row of adRows){
  if(row.date_start<scope.from||row.date_start>scope.to)continue;
  if(String(row.account_id)!==scope.accountId||row.account_currency!==scope.currency||row.date_stop!==row.date_start)fail('account_audit_scope_mismatch');
  sum(expected.get(row.date_start),metrics(row,eventKeys));
 }
 let pages=0;
 async function readAccount(from,to){
 const actual=new Map(),seen=new Set();let cursor=null,requestPages=0;
 do{
  pages++;if(++requestPages>100)fail('account_audit_pagination_limit');
  const response=await fetchPage({fields:'account_id,account_currency,date_start,date_stop,impressions,clicks,spend,actions,action_values',level:'account',time_increment:'1',time_range:JSON.stringify({since:from,until:to}),limit:'500',...(cursor?{after:cursor}:{})});
  if(!Array.isArray(response.data))fail('account_audit_invalid_schema');
  for(const row of response.data){
   if(String(row.account_id)!==scope.accountId||row.account_currency!==scope.currency||row.date_stop!==row.date_start||row.date_start<from||row.date_start>to||!expected.has(row.date_start))fail('account_audit_scope_mismatch');
   if(actual.has(row.date_start))fail('account_audit_duplicate_day');
   actual.set(row.date_start,metrics(row,eventKeys));
  }
  if(!response.paging?.next){cursor=null;break;}
  let url;try{url=new URL(response.paging.next);}catch{fail('account_audit_pagination_scope');}
  if(url.origin!=='https://graph.facebook.com'||url.pathname!==`/${scope.apiVersion}/act_${scope.accountId}/insights`)fail('account_audit_pagination_scope');
  cursor=url.searchParams.get('after');if(!cursor||seen.has(cursor))fail('account_audit_pagination_cycle');seen.add(cursor);
 }while(cursor);
 return actual;
 }
 const actual=await readAccount(scope.from,scope.to);
 // Meta can return incomplete multi-day insights without an HTTP error. Retry
 // only discrepant days, with bounded concurrency and the caller's deadline.
 // A retry is accepted only when the independent totals match every metric.
 let retriedDays=0;
 if(dailyFallback){
  const queue=[...expected].filter(([date,ads])=>Object.keys(ads).some(k=>ads[k]!==((actual.get(date)||zero())[k])));
  await Promise.all(Array.from({length:Math.min(3,queue.length)},async()=>{
   while(queue.length){const [date,ads]=queue.shift();retriedDays++;
    try{const retry=(await readAccount(date,date)).get(date)||zero();if(Object.keys(ads).every(k=>ads[k]===retry[k]))actual.set(date,retry);}catch{}
   }
  }));
 }
 const accountTotals=zero(),adTotals=zero();
 const daily=[...expected].map(([date,ads])=>{
  const account=actual.get(date)||zero();sum(accountTotals,account);sum(adTotals,ads);
  const differences=Object.fromEntries(Object.keys(account).map(key=>[key,subtract(ads[key],account[key])]));
  return {date,account,ads,differences,matched:Object.values(differences).every(v=>v==='0')};
 });
 return {schemaVersion:'meta-account-reconciliation/1',status:daily.every(d=>d.matched)?'matched':'mismatch',
  checkedAt:new Date().toISOString(),scope,resultActionTypes:eventKeys,accountReportPages:pages,
  attribution:{actionReportTime:'api_default',attributionSettings:'api_default',adsManagerSelectionVerified:false},
  comparedDays:daily.length,matchedDays:daily.filter(d=>d.matched).length,retriedDays,
  accountTotals,adTotals,daily};
}
