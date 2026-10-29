import {valueOf} from '../unified/model.js';
export const productKeys=['landingViews','registrations','trials'];
export const eventKeys={landingViews:['landing_page_view'],registrations:['offsite_conversion.fb_pixel_complete_registration','complete_registration','omni_complete_registration'],trials:['offsite_conversion.fb_pixel_start_trial','start_trial','omni_start_trial']};
export function actionValue(row,keys){for(const key of keys){const a=[...(row.actions||[]),...(row.conversions||[])].find(a=>a.action_type===key&&a.value!=null);if(a){const n=Number(a.value);return Number.isFinite(n)&&n>=0?n:null;}}return 0;}
export function campaignDimensions(name,adName='',metadata=null){
 const tokens=String(name||'').toLowerCase().split(/[\s/|_\-]+/).filter(Boolean);
 const language=tokens.some(t=>['eng','en','english','англ'].includes(t))?'en':tokens.some(t=>['ru','rus','russian','рус'].includes(t))?'ru':tokens.some(t=>['ua','uk','ukr'].includes(t))?'uk':'unknown';
 const namedGeo=tokens.includes('eu')?'EU':tokens.includes('cis')?'CIS':null;
 const countries=metadata?.adset?.targeting?.geo_locations?.countries;
 const validCountries=Array.isArray(countries)&&countries.length&&countries.every(c=>/^[A-Z]{2}$/.test(c))?[...new Set(countries)].sort():[];
 const geo=namedGeo||validCountries.join(', ')||'unknown';
 const creative=metadata?.creative||{},story=creative.object_story_spec||{},feed=creative.asset_feed_spec||{};
 const urls=[creative.object_url,story.link_data?.link,story.video_data?.call_to_action?.value?.link,...(feed.link_urls||[]).map(l=>l.website_url)].filter(Boolean);
 const pages=[...new Set(urls.map(v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.origin+u.pathname:null;}catch{return null;}}).filter(Boolean))];
 const namedLanding=String(adName||'').toLowerCase().split(/[\s/|_\-]+/).filter(t=>['quiz','warp'].includes(t));
 let landing='unknown',landingBasis='unknown';
 if(pages.length===1){const u=new URL(pages[0]),t=(u.hostname+' '+u.pathname).toLowerCase().split(/[^a-z0-9]+/);landing=t.includes('quiz')?'quiz':t.includes('warp')?'warp':pages[0];landingBasis='creative_url';}
 else if(pages.length>1){landing='multiple';landingBasis='multiple_urls';}
 else if(new Set(namedLanding).size===1){landing=namedLanding[0];landingBasis='ad_name';}
 return {language,geo,geoBasis:namedGeo?'campaign_name':validCountries.length?'adset_targeting':'unknown',landing,landingBasis};
}
export function safeDimensions(v){if(!v||typeof v!=='object')return null;return Object.fromEntries(['language','geo','geoBasis','landing','landingBasis'].map(k=>[k,typeof v[k]==='string'?v[k].slice(0,500):'unknown']));}
export function productRows(provider){
 if(provider.provider!=='meta_ads'||!provider.hierarchy)return [];
 const rows=[];const currency=provider.hierarchy.currency;
 for(const c of provider.hierarchy.children||[])for(const g of c.children||[])for(const a of g.children||[]){const outcomes=new Map((a.outcomeDaily||[]).map(d=>[d.date,d.metrics]));
 for(const d of a.dailyMetrics||[]){const o=outcomes.get(d.date)||{},m=d.metrics||{};rows.push({date:d.date,campaignId:c.providerId,campaign:c.name||c.providerId,adId:a.providerId,currency,dimensions:safeDimensions(a.funnelDimensions)||campaignDimensions(c.name,a.name),spend:valueOf(m.spend),impressions:valueOf(m.impressions),clicks:valueOf(m.clicks),...Object.fromEntries(['landingViews','leads','registrations','trials','purchases','purchaseValue'].map(k=>[k,valueOf(o[k])]))});}
 }return rows;
}
export const metricKeys=['spend','impressions','clicks','landingViews','leads','registrations','trials','purchases','purchaseValue'];
export function totals(rows){const out={};for(const k of metricKeys){out[k]=rows.length&&rows.every(r=>r[k]!==null&&Number.isFinite(r[k]))?rows.reduce((s,r)=>s+r[k],0):null;}
 const ratio=(a,b,mult=1)=>out[a]!==null&&out[b]>0?out[a]/out[b]*mult:null;
 return {...out,cpc:ratio('spend','clicks'),cpl:ratio('spend','leads'),registrationCost:ratio('spend','registrations'),trialCost:ratio('spend','trials'),purchaseCost:ratio('spend','purchases'),clickRegistrationRate:ratio('registrations','clicks',100),registrationTrialRate:ratio('trials','registrations',100),clickTrialRate:ratio('trials','clicks',100),roas:ratio('purchaseValue','spend')};
}
export function summarize(rows,filters={}){
 const distinctCurrencies=new Set(rows.map(r=>r.currency)),scoped=rows.filter(r=>filters.currency?r.currency===filters.currency:distinctCurrencies.size<=1),filtered=scoped.filter(r=>['language','geo','landing'].every(k=>!filters[k]||r.dimensions[k]===filters[k]));
 const group=keys=>{const map=new Map();for(const r of filtered){const key=JSON.stringify(keys.map(k=>k in r?r[k]:r.dimensions[k]));if(!map.has(key))map.set(key,[]);map.get(key).push(r);}return [...map.values()].map(group=>({campaignId:group[0].campaignId,campaign:group[0].campaign,language:group[0].dimensions.language,geo:group[0].dimensions.geo,landing:group[0].dimensions.landing,...totals(group)})).sort((a,b)=>(b.spend||0)-(a.spend||0));};
 return {totals:totals(filtered),campaigns:group(['campaignId','language']),landings:group(['campaignId','landing']),rows:filtered.length,options:Object.fromEntries(['language','geo','landing'].map(k=>[k,[...new Set(scoped.map(r=>r.dimensions[k]))].sort()])),currencies:[...new Set(rows.map(r=>r.currency))].sort(),unknown:filtered.filter(r=>Object.values(r.dimensions).includes('unknown')).length};
}
