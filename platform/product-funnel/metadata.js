import {campaignDimensions} from './model.js';
export async function attachProductDimensions(ads,rows,readObjects,accountId){
 const byId=new Map(rows.map(r=>[String(r.ad_id),r]));let next=0;
 // Metadata failures never invent a destination or allocate spend between URLs.
 const ids=ads.map(a=>String(a.id)),metadata={};
 await Promise.all(Array.from({length:Math.min(3,Math.ceil(ids.length/50))},async()=>{while(next<ids.length){const batch=ids.slice(next,next+=50);try{const data=await readObjects(batch,'id,account_id,creative{object_url,object_story_spec,asset_feed_spec},adset{targeting}');for(const id of batch)if(String(data?.[id]?.id)===id&&!data[id].error&&String(data[id].account_id)===String(accountId))metadata[id]=data[id];}catch{}}}));
 for(const a of ads){const r=byId.get(String(a.id));a.funnelDimensions=campaignDimensions(r?.campaign_name,r?.ad_name,metadata[String(a.id)]);}
}
