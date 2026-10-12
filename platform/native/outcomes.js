// Explicit business events only: never label a generic conversion or click as a sale.
export const outcomeKeys=['leads','purchases','purchaseValue','qualifiedLeads'];
export function normalizeOutcomes(rows,from,to){
 const seen=new Set();return (Array.isArray(rows)?rows:[]).filter(r=>r.date>=from&&r.date<=to&&!seen.has(r.date)&&seen.add(r.date)).map(r=>({date:r.date,metrics:Object.fromEntries(outcomeKeys.map(k=>{const v=r.metrics?.[k];const valid=v!==null&&v!==undefined&&/^\d+(?:\.\d+)?$/.test(String(v));return [k,{value:valid?String(v):null,state:valid?'observed':'unsupported'}];}))}));
}
export function enrichMetaOutcomes(normalized,rows){
 const byAd=new Map();for(const r of rows){if(!byAd.has(r.ad_id))byAd.set(r.ad_id,[]);const action=(items,key)=>items?.find(a=>a.action_type===key)?.value??null;byAd.get(r.ad_id).push({date:r.date_start,metrics:{leads:action(r.actions,'lead'),purchases:action(r.actions,'omni_purchase'),purchaseValue:action(r.action_values,'omni_purchase'),qualifiedLeads:null}});}
 const ads=[];for(const c of normalized.campaigns)for(const g of (c.adsets||c.groups||[]))for(const a of g.ads){a.outcomeDaily=byAd.get(a.id)||[];ads.push(a);}
 const score=(a,key)=>{const values=a.outcomeDaily.map(r=>r.metrics[key]);return values.length&&values.every(v=>v!==null)?values.reduce((s,v)=>s+Number(v),0):null;};
 const ids=new Set();for(const key of ['leads','purchases','purchaseValue'])ads.filter(a=>score(a,key)!==null).sort((a,b)=>score(b,key)-score(a,key)).slice(0,3).forEach(a=>ids.add(a.id));
 return {ads,ids:[...ids]};
}
export function safePreview(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&/(^|\.)(fbcdn\.net|fbsbx\.com)$/.test(u.hostname)?u.href:null;}catch{return null;}}
