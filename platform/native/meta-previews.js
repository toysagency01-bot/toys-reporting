import {safePreview} from './outcomes.js';

export async function attachMetaPreviews(ads,ids,get){
 const selected=new Set(ids),queue=ads.filter(ad=>selected.has(ad.id));
 await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{
  while(queue.length){const ad=queue.shift();
   try{
    // Query the ad node explicitly; the multi-ID root request can fail as a
    // whole and previously left every card without metadata or an error state.
    const item=await get(ad.id,'id,creative{id,thumbnail_url,image_url}');
    if(String(item.id)!==String(ad.id))throw Object.assign(new Error(),{code:'preview_identity_mismatch'});
    let creative=item.creative;
    if(creative?.id&&!creative.image_url&&!creative.thumbnail_url)creative=await get(String(creative.id),'id,thumbnail_url,image_url');
    if(creative?.id&&!creative.image_url){
     // Ask Meta for a large video poster; retain the existing preview if denied.
     try{const large=await get(String(creative.id),'id,thumbnail_url,image_url',{thumbnail_width:'1080',thumbnail_height:'1080'});if(String(large.id)===String(creative.id))creative={...creative,...large};}catch{}
    }
    ad.creativeRef=creative?.id?String(creative.id):null;
    ad.previewUrl=safePreview(creative?.image_url)||safePreview(creative?.thumbnail_url);
    ad.previewStatus=ad.previewUrl?'ready':'image_unavailable';
   }catch(error){ad.previewUrl=null;ad.previewStatus='request_failed';ad.previewError={code:/^[a-z_]+$/.test(error.code||'')?error.code:'preview_request_failed',providerCode:Number.isInteger(error.providerCode)?error.providerCode:null,providerSubcode:Number.isInteger(error.providerSubcode)?error.providerSubcode:null};}
  }
 }));
}
