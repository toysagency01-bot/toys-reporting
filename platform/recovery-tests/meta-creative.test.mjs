import test from 'node:test';import assert from 'node:assert/strict';
import {creativePresentation,loadMetaCreative,creativeKey,safeCreativeLink} from '../native/meta-creative.js';
import {fixture} from './fixture.mjs';
const cdn='https://scontent.xx.fbcdn.net/';
test('creative presentation resolves original images, full copy, carousel and dynamic text variants without HTML execution',()=>{
 const creative={thumbnail_url:cdn+'tiny.jpg',object_story_spec:{link_data:{message:'Полный текст\n<script>alert(1)</script>',name:'Заголовок',link:'https://example.test/product',call_to_action:{type:'SHOP_NOW'},child_attachments:[{image_hash:'one',picture:cdn+'small.jpg',name:'Первый кадр'},{image_hash:'two',name:'Второй кадр'}]}},asset_feed_spec:{bodies:[{text:'Вариант 2'},{text:'Вариант 3'}]}};
 const result=creativePresentation(creative,{images:[{hash:'one',url:cdn+'full-one.jpg'},{hash:'two',url:cdn+'full-two.jpg'}]});
 assert.deepEqual(result.media.map(m=>m.url),[cdn+'full-one.jpg',cdn+'full-two.jpg']);assert.equal(result.mediaStatus,'ready');assert.ok(result.bodies[0].includes('<script>'));assert.equal(result.bodies.length,3);assert.equal(result.multipleVariants,true);assert.equal(result.callToAction,'SHOP_NOW');
 assert.equal(safeCreativeLink('javascript:alert(1)'),null);assert.equal(safeCreativeLink('https://example.test/?access_token=secret'),null);assert.equal(safeCreativeLink('https://user:password@example.test/'),null);
});
test('videos use playable source and highest-resolution poster, with honest thumbnail-only fallback',()=>{
 const creative={video_id:'44',thumbnail_url:cdn+'tiny.jpg'};
 const playable=creativePresentation(creative,{videos:[{id:'44',source:cdn+'full.mp4',thumbnails:{data:[{uri:cdn+'small.jpg',width:64,height:64},{uri:cdn+'large.jpg',width:1080,height:1080}]}}]});
 assert.equal(playable.media[0].kind,'video');assert.equal(playable.media[0].poster,cdn+'large.jpg');
 const unavailable=creativePresentation(creative);assert.equal(unavailable.mediaStatus,'preview_only');assert.equal(unavailable.media[0].kind,'preview');assert.equal(unavailable.hasVideo,true);
});
test('detail loader verifies project and account before fetching full assets; optional Meta denials retain text and successful media; server cache avoids repeat Graph requests',async()=>{
 const {env,db}=fixture();env.META_ADS_ACCESS_TOKEN='private-token';env.META_APP_SECRET='private-secret';
 db.exec(`INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES('meta-one','prj_housevip_cxp7','meta_ads','123','active','{}')`);
 const project={id:'prj_housevip_cxp7'},ref={integrationId:'meta-one',accountId:'123',adId:'3'},calls=[],memory=new Map();
 const cache={match:async r=>memory.get(r.url)?.clone(),put:async(r,response)=>memory.set(r.url,response)};
 const fetchImpl=async(input,options)=>{const u=new URL(input);calls.push(u);assert.equal(options.headers.authorization,'Bearer private-token');assert.ok(u.searchParams.get('appsecret_proof'));if(u.pathname.endsWith('/3'))return Response.json({id:'3',account_id:'123',name:'Creative',creative:{id:'33'}});if(u.pathname.endsWith('/33'))return Response.json({id:'33',body:'Full text',video_id:'44',thumbnail_url:cdn+'tiny.jpg',effective_object_story_id:'7_8'});if(u.pathname.endsWith('/44'))return Response.json({id:'44',source:cdn+'movie.mp4',picture:cdn+'poster.jpg'});return Response.json({error:{message:'private provider failure'}},{status:403});};
 try{const result=await loadMetaCreative(env,project,ref,{fetchImpl,cache});assert.equal(result.media[0].kind,'video');assert.deepEqual(result.bodies,['Full text']);assert.ok(!JSON.stringify(result).includes('private'));assert.equal(calls.find(u=>u.pathname.endsWith('/33')).searchParams.get('thumbnail_width'),'1080');const count=calls.length;await loadMetaCreative(env,project,ref,{fetchImpl,cache});assert.equal(calls.length,count);
 await assert.rejects(loadMetaCreative(env,{id:'another-project'},ref,{fetchImpl,cache}),{code:'creative_not_found'});assert.equal(calls.length,count);
 await assert.rejects(loadMetaCreative(env,project,{...ref,accountId:'456'},{fetchImpl,cache}),{code:'creative_not_found'});
 assert.notEqual(await creativeKey(project.id,ref),await creativeKey('another-project',ref));
 const wrongAccount=async()=>Response.json({id:'3',account_id:'456',creative:{id:'33'}});await assert.rejects(loadMetaCreative(env,project,ref,{fetchImpl:wrongAccount,cache:null}),{code:'creative_not_found'});
 }finally{db.close();}
});
