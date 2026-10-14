import {escapeHtml as h} from '../unified/model.js';
const cache=new Map(),pending=new Map();
const link=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const ctaLabels={SHOP_NOW:'Купить',LEARN_MORE:'Подробнее',SIGN_UP:'Зарегистрироваться',CONTACT_US:'Связаться',SEND_MESSAGE:'Написать',WHATSAPP_MESSAGE:'Написать в WhatsApp',BOOK_TRAVEL:'Забронировать',GET_QUOTE:'Получить предложение',DOWNLOAD:'Скачать',APPLY_NOW:'Оставить заявку',ORDER_NOW:'Заказать',SUBSCRIBE:'Подписаться'};
async function details(url){
 const cached=cache.get(url);if(cached&&Date.now()-cached.at<300000)return cached.value;
 if(pending.has(url))return pending.get(url);
 const promise=(async()=>{const response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(16000)});const data=await response.json();if(!response.ok||!data.ok)throw new Error('creative_unavailable');cache.set(url,{value:data.creative,at:Date.now()});while(cache.size>40)cache.delete(cache.keys().next().value);return data.creative;})();
 pending.set(url,promise);try{return await promise;}finally{pending.delete(url);}
}
const detailURL=(row,slug,range,endpoint='top-creatives')=>`/api/v2/projects/${encodeURIComponent(slug)}/${endpoint==='campaign-browser'?'campaign-browser/'+row.detailsKey+'/creative':'top-creatives/'+row.detailsKey}?${new URLSearchParams(range)}`;
const previewJobs=new WeakMap(),previewQueue=[],observedPreviews=new Set();
let previewObserver,activePreviews=0;
function previewMessage(host,message){
 host.querySelector(':scope > img')?.remove();
 let note=host.querySelector(':scope > .creative-preview-placeholder');
 if(!note){note=document.createElement('span');note.className='creative-preview-placeholder';host.prepend(note);}
 note.textContent=message;
}
function updatePreview(host,creative,name){
 if(!host?.isConnected)return;
 const version=host._previewVersion=(host._previewVersion||0)+1;
 // Only still images/posters: never download or autoplay video in a ranking card.
 const media=creative.media||[],urls=[...new Set([
  ...media.filter(m=>m.kind==='image').map(m=>m.url),
  ...media.filter(m=>m.kind==='video').map(m=>m.poster),
  ...media.filter(m=>m.kind==='preview').map(m=>m.url),creative.previewUrl
 ].map(link).filter(Boolean))];
 const attempt=index=>{
  if(!host.isConnected||host._previewVersion!==version)return;
  if(index>=urls.length){previewMessage(host,creative.hasVideo||media.some(m=>m.kind==='video')?'Видео — откройте креатив':'Предпросмотр недоступен. Откройте креатив.');return;}
  const img=new Image();img.alt=name;img.decoding='async';img.referrerPolicy='no-referrer';
  img.onload=()=>{if(!host.isConnected||host._previewVersion!==version)return;host.querySelector(':scope > img')?.remove();host.querySelector(':scope > .creative-preview-placeholder')?.remove();host.prepend(img);};
  img.onerror=()=>attempt(index+1);img.src=urls[index];
 };
 attempt(0);
}
function drainPreviews(){
 while(activePreviews<2&&previewQueue.length){
  const job=previewQueue.shift();if(!job.host.isConnected)continue;
  activePreviews++;
  details(job.url).then(creative=>updatePreview(job.host,creative,job.name)).catch(()=>{if(job.host.isConnected)previewMessage(job.host,'Не удалось загрузить предпросмотр. Откройте креатив.');}).finally(()=>{activePreviews--;drainPreviews();});
 }
}
export function watchCreativePreview({host,row,slug,range}){
 for(const old of observedPreviews)if(!old.isConnected){previewObserver.unobserve(old);observedPreviews.delete(old);}
 if(previewJobs.has(host))return;
 const job={host,url:row.detailsKey?detailURL(row,slug,range):null,name:row.name,queued:false};previewJobs.set(host,job);
 const enqueue=()=>{if(job.queued||!job.url)return;job.queued=true;previewQueue.push(job);drainPreviews();};
 job.enqueue=enqueue;
 const recover=()=>{
  previewMessage(host,job.url?'Загружаем предпросмотр…':'Предпросмотр недоступен');
  if(!job.url)return;
  if(typeof IntersectionObserver==='undefined'){enqueue();return;}
  if(!previewObserver)previewObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){previewObserver.unobserve(entry.target);observedPreviews.delete(entry.target);previewJobs.get(entry.target)?.enqueue();}});
  previewObserver.observe(host);observedPreviews.add(host);
 };
 const cached=job.url&&cache.get(job.url);
 if(cached&&Date.now()-cached.at<300000){updatePreview(host,cached.value,row.name);return;}
 const img=host.querySelector(':scope > img');
 if(img){img.onerror=recover;if(img.complete&&!img.naturalWidth)recover();}else recover();
}
export function openCreative({row,slug,range,trigger,endpoint='top-creatives'}){
 const provider=row?.provider==='google_ads'?'Google Ads':'Meta';
 if(!row?.detailsKey)return;
 let dialog=document.getElementById('creativeViewer');if(dialog?.open)dialog._closeCreative();if(dialog)dialog.remove();
 dialog=document.createElement('dialog');dialog.id='creativeViewer';dialog.className='creative-viewer';dialog.setAttribute('aria-labelledby','creativeViewerTitle');
 dialog.innerHTML=`<div class="creative-viewer-heading"><div><span>${provider==='Meta'?'Meta Ads':provider} · Объявление</span><h2 id="creativeViewerTitle">${h(row.name)}</h2></div><button type="button" class="creative-viewer-close" aria-label="Закрыть креатив" autofocus>×</button></div><div class="creative-viewer-body" aria-live="polite"><p class="creative-detail-status" role="status">Загружаем медиа и текст объявления…</p></div>`;
 document.body.append(dialog);const body=dialog.querySelector('.creative-viewer-body');
 const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
 let cleaned=false;
 const cleanup=()=>{if(cleaned)return;cleaned=true;dialog.querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});document.body.style.overflow=previousOverflow;if(trigger?.isConnected)trigger.focus({preventScroll:true});};
 dialog._closeCreative=()=>{cleanup();dialog.close();};
 dialog.querySelector('.creative-viewer-close').onclick=dialog._closeCreative;
 dialog.addEventListener('close',cleanup,{once:true});dialog.addEventListener('cancel',cleanup,{once:true});
 dialog.onclick=e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog._closeCreative();};
 dialog.showModal();
 const url=detailURL(row,slug,range,endpoint);
 async function load(){
  body.innerHTML='<p class="creative-detail-status" role="status">Загружаем медиа и текст объявления…</p>';
  try{const d=await details(url);updatePreview(trigger?.closest('.creative-preview'),d,row.name);if(!dialog.open||!dialog.isConnected)return;
   const media=(d.media||[]).filter(m=>link(m.url));let index=0;
   const texts=(items,label)=>items?.length?`<section class="creative-copy"><h3>${label}</h3>${items.map(t=>`<p>${h(t)}</p>`).join('')}</section>`:'';
   body.innerHTML=`<div class="creative-viewer-layout"><div class="creative-media-column"><div class="creative-viewer-media"></div>${media.length>1?'<div class="creative-media-navigation"><button type="button" data-direction="-1" aria-label="Предыдущий файл">←</button><span aria-live="polite"></span><button type="button" data-direction="1" aria-label="Следующий файл">→</button></div>':''}<div class="creative-media-link"></div></div><div class="creative-viewer-copy">${d.contentStatus==='metadata_only'?'<p class="creative-detail-note">Google передал статистику и параметры объявления. Текст и исходные медиа в текущей интеграции недоступны.</p>':''}${d.multipleVariants?'<p class="creative-detail-note">В объявлении несколько вариантов. Meta подбирает их сочетание при показе.</p>':''}${texts(d.bodies,'Текст объявления')}${texts(d.titles,'Заголовок')}${texts(d.descriptions,'Описание')}${!d.bodies?.length&&!d.titles?.length&&!d.descriptions?.length?`<p class="creative-detail-note">${provider} не предоставила текст этого объявления.</p>`:''}${link(d.destinationUrl)?`<a class="creative-destination" href="${h(d.destinationUrl)}" target="_blank" rel="noopener noreferrer">${h(ctaLabels[d.callToAction]||'Перейти по ссылке объявления')}</a>`:''}${link(d.postUrl)?`<a class="creative-post-link" href="${h(d.postUrl)}" target="_blank" rel="noopener noreferrer">Открыть публикацию в Meta</a>`:''}</div></div>`;
   const target=body.querySelector('.creative-viewer-media'),original=body.querySelector('.creative-media-link');
   const show=()=>{target.querySelector('video')?.pause();const item=media[index];
    target.innerHTML=!item?`<p class="creative-detail-note">${provider} не предоставила медиафайл.</p>`:item.kind==='video'?`<video controls playsinline preload="metadata" ${link(item.poster)?`poster="${h(item.poster)}"`:''} src="${h(item.url)}" aria-label="${h(row.name)}"></video>`:`<img src="${h(item.url)}" alt="${h(item.title||row.name)}" decoding="async" referrerpolicy="no-referrer">`;
    original.innerHTML=item?`${item.kind==='preview'?`<p class="creative-detail-note">Доступно только превью. ${d.hasVideo?'Meta не предоставила исходное видео.':'Meta не предоставила изображение высокого разрешения.'}</p>`:`<a href="${h(item.url)}" target="_blank" rel="noopener noreferrer">Открыть ${item.kind==='video'?'видео':'изображение'} отдельно</a>`}`:'';
    const position=body.querySelector('.creative-media-navigation span');if(position)position.textContent=`${index+1} / ${media.length}`;
    const element=target.querySelector('img,video');if(element)element.addEventListener('error',()=>{const note=document.createElement('p');note.className='creative-detail-note';note.textContent=`Не удалось загрузить медиафайл из ${provider}. Попробуйте открыть его отдельно или повторить загрузку.`;target.replaceChildren(note);const retry=document.createElement('button');retry.type='button';retry.className='creative-retry';retry.textContent='Повторить загрузку';retry.onclick=()=>{cache.delete(url);load();};target.append(retry);},{once:true});
   };
   body.querySelectorAll('[data-direction]').forEach(b=>b.onclick=()=>{index=(index+Number(b.dataset.direction)+media.length)%media.length;show();});show();
   const preview=media.find(m=>m.kind==='image')?.url||media.find(m=>m.kind==='video')?.poster;
   if(preview&&trigger?.isConnected&&!trigger.closest('.creative-preview')){const img=trigger.parentElement.querySelector('img');if(img)img.src=preview;}
  }catch{if(!dialog.open||!dialog.isConnected)return;body.innerHTML=`<div class="creative-detail-status" role="status"><p>Не удалось получить креатив из ${provider}. Статистика сохранена.</p><button type="button" class="creative-retry">Повторить загрузку</button></div>`;body.querySelector('button').onclick=load;}
 }
 load();
}
