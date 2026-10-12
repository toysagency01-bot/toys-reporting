import {createHmac} from 'node:crypto';
import {safePreview} from './outcomes.js';

const text=value=>typeof value==='string'?value.trim().slice(0,20000):'';
const id=value=>/^\d+(?:_\d+)?$/.test(String(value||''))?String(value):null;
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function safeCreativeLink(value){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||[...u.searchParams.keys()].some(k=>/^(access_token|appsecret_proof)$/i.test(k)))return null;return u.href;}catch{return null;}
}
export async function creativeKey(projectId,ref){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([projectId,ref.integrationId,ref.adId])));
 return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
// Explicit presentation fields only: never return the provider payload or credentials.
export function creativePresentation(creative,{post=null,videos=[],images=[]}={}){
 const story=creative.object_story_spec||{},link=story.link_data||{},video=story.video_data||{},photo=story.photo_data||{},feed=creative.asset_feed_spec||{};
 const unique=values=>[...new Set(values.map(text).filter(Boolean))];
 const bodies=unique([post?.message,link.message,video.message,photo.caption,creative.body,...(feed.bodies||[]).map(v=>v.text)]);
 const titles=unique([link.name,video.title,creative.title,...(feed.titles||[]).map(v=>v.text)]);
 const descriptions=unique([link.description,video.link_description,...(feed.descriptions||[]).map(v=>v.text)]);
 const hasVideo=Boolean(creative.video_id||video.video_id||(feed.videos||[]).length||(link.child_attachments||[]).some(c=>c.video_id));
 const media=[];
 const add=(kind,url,poster=null,title='')=>{url=safePreview(url);poster=safePreview(poster);if(!url||media.some(m=>m.url===url))return;media.push({kind,url,poster,title:text(title)});};
 const bestThumb=v=>[...(v.thumbnails?.data||[])].sort((a,b)=>(b.width||0)*(b.height||0)-(a.width||0)*(a.height||0)).map(t=>safePreview(t.uri)).find(Boolean)||safePreview(v.picture);
 for(const v of videos)if(v.source)add('video',v.source,bestThumb(v));
 const carousel=link.child_attachments||[];
 for(const child of carousel){const image=images.find(i=>i.hash===child.image_hash);add('image',image?.url||child.picture,null,child.name);}
 for(const image of images)if(!carousel.length||!carousel.some(c=>c.image_hash===image.hash))add('image',image.url);
 if(!media.length&&!hasVideo)add('image',creative.image_url);
 for(const a of post?.attachments?.data||[]){for(const part of a.subattachments?.data||[a]){
  if(!String(part.type||'').includes('video')&&!hasVideo)add('image',part.media?.image?.src,null,part.title);
 }}
 for(const a of feed.images||[])add('image',a.url);
 if(!media.length&&!hasVideo){add('image',creative.image_url||link.picture||photo.url||post?.full_picture);}
 const previewUrl=safePreview(creative.image_url)||videos.map(bestThumb).find(Boolean)||safePreview(post?.full_picture)||safePreview(video.image_url)||safePreview(link.picture)||safePreview(creative.thumbnail_url);
 // A thumbnail remains a thumbnail; do not claim it is the original asset.
 if(!media.length&&previewUrl)media.push({kind:'preview',url:previewUrl,poster:null,title:''});
 const rawCTA=link.call_to_action||video.call_to_action||{};
 const destinationUrl=safeCreativeLink(link.link||rawCTA.value?.link||feed.link_urls?.[0]?.website_url);
 const postUrl=safeCreativeLink(post?.permalink_url);
 return {bodies,titles,descriptions,media:media.slice(0,20),previewUrl,destinationUrl,postUrl,callToAction:text(rawCTA.type||feed.call_to_action_types?.[0]),hasVideo,multipleVariants:((feed.bodies||[]).length>1||(feed.images||[]).length>1||(feed.videos||[]).length>1),mediaStatus:media.some(m=>m.kind!=='preview')?'ready':previewUrl?'preview_only':'unavailable'};
}
export async function loadMetaCreative(env,project,ref,{fetchImpl=fetch,cache=globalThis.caches?.default}={}){
 const integration=await env.TOYS_DB.prepare("SELECT external_account_id AS accountId,config_json AS configJson FROM integrations WHERE id=? AND project_id=? AND provider='meta_ads' AND status='active'").bind(ref.integrationId,project.id).first();
 if(!integration||!/^\d+$/.test(String(ref.adId)))fail('creative_not_found');
 const account=String(integration.accountId).replace(/^act_/,'');if(!/^\d+$/.test(account)||account!==String(ref.accountId).replace(/^act_/,''))fail('creative_not_found');
 const key=await creativeKey(project.id,ref),cacheRequest=new Request('https://creative-cache.invalid/v1/'+key);
 const hit=cache&&await cache.match(cacheRequest).catch(()=>null);if(hit)return hit.json();
 const token=env.META_ADS_ACCESS_TOKEN,secret=env.META_APP_SECRET;if(!token||!secret)fail('creative_unavailable');
 let config={};try{config=JSON.parse(integration.configJson||'{}');}catch{}
 const version=/^v\d+\.\d+$/.test(config.apiVersion||'')?config.apiVersion:'v26.0';
 const proof=createHmac('sha256',secret).update(token).digest('hex'),signal=AbortSignal.timeout(12000);
 const get=async(path,fields,extra={})=>{
  if(!/^(?:\d+(?:_\d+)?|act_\d+\/adimages)$/.test(path))fail('creative_not_found');
  const params=new URLSearchParams({fields,appsecret_proof:proof,...extra});
  const r=await fetchImpl(`https://graph.facebook.com/${version}/${path}?${params}`,{headers:{authorization:'Bearer '+token},redirect:'error',signal});
  const data=await r.json();if(!r.ok||data.error)fail('creative_unavailable');return data;
 };
 const ad=await get(String(ref.adId),'id,account_id,name,creative{id}');
 if(String(ad.id)!==String(ref.adId)||String(ad.account_id)!==account||!id(ad.creative?.id))fail('creative_not_found');
 const creative=await get(String(ad.creative.id),'id,name,title,body,image_url,image_hash,thumbnail_url,video_id,object_story_spec,asset_feed_spec,effective_object_story_id,object_story_id',{thumbnail_width:'1080',thumbnail_height:'1080'});
 if(String(creative.id)!==String(ad.creative.id))fail('creative_not_found');
 const story=creative.object_story_spec||{},feed=creative.asset_feed_spec||{},link=story.link_data||{};
 const videoIds=[...new Set([creative.video_id,story.video_data?.video_id,...(feed.videos||[]).map(v=>v.video_id),...(link.child_attachments||[]).map(v=>v.video_id)].map(id).filter(Boolean))].slice(0,10);
 const hashes=[...new Set([creative.image_hash,link.image_hash,story.photo_data?.image_hash,...(feed.images||[]).map(v=>v.hash),...(link.child_attachments||[]).map(v=>v.image_hash)].filter(v=>typeof v==='string'&&/^[a-f\d]{16,64}$/i.test(v)))].slice(0,20);
 const postId=id(creative.effective_object_story_id||creative.object_story_id);
 const optional=promise=>promise.catch(()=>null);
 const [post,imageData,...videos]=await Promise.all([
  postId?optional(get(postId,'id,message,full_picture,permalink_url,attachments{media,type,title,subattachments{media,type,title}}')):null,
  hashes.length?optional(get('act_'+account+'/adimages','hash,url,width,height',{hashes:JSON.stringify(hashes)})):null,
  ...videoIds.map(videoId=>optional(get(videoId,'id,source,picture,thumbnails{uri,width,height}')))
 ]);
 const result={name:text(ad.name||creative.name),...creativePresentation(creative,{post:post&&String(post.id)===postId?post:null,images:(imageData?.data||[]).filter(i=>hashes.includes(i.hash)),videos:videos.filter(v=>v&&videoIds.includes(String(v.id)))})};
 if(cache&&result.mediaStatus==='ready')await cache.put(cacheRequest,Response.json(result,{headers:{'cache-control':'max-age=300'}})).catch(()=>{});
 return result;
}
