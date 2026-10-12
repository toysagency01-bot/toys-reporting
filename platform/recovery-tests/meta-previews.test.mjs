import test from 'node:test';import assert from 'node:assert/strict';
import {attachMetaPreviews} from '../native/meta-previews.js';import {safePreview} from '../native/outcomes.js';
test('ad-node images and video thumbnails load independently; a rejected ad does not erase other previews',async()=>{
 const ads=[{id:'1'},{id:'2'},{id:'3'},{id:'4'}],calls=[];
 await attachMetaPreviews(ads,['1','2','3','4'],async(id,fields)=>{
  calls.push([id,fields]);if(id==='1')return{id:'1',creative:{id:'11',image_url:'https://scontent.xx.fbcdn.net/image.jpg'}};
  if(id==='2')return{id:'2',creative:{id:'22'}};
  if(id==='22')return{id:'22',thumbnail_url:'https://scontent.cdninstagram.com/video.jpg'};
  if(id==='3')throw Object.assign(new Error('sensitive provider message'),{code:'provider_http_error',providerCode:100,providerSubcode:33});
  return{id:'other-account-ad',creative:{id:'44',image_url:'https://scontent.xx.fbcdn.net/wrong.jpg'}};
 });
 assert.equal(ads[0].previewStatus,'ready');assert.equal(ads[1].previewStatus,'ready');assert.ok(calls.some(([id])=>id==='22'));assert.equal(ads[2].previewError.providerCode,100);assert.equal(ads[3].previewError.code,'preview_identity_mismatch');assert.ok(!JSON.stringify(ads).includes('sensitive provider message'));
});
test('preview URLs allow official Instagram CDN but reject lookalike hosts and credentials',()=>{
 assert.equal(safePreview('https://scontent.cdninstagram.com/a.jpg'),'https://scontent.cdninstagram.com/a.jpg');
 for(const u of ['https://cdninstagram.com.evil.test/a','https://evilcdninstagram.com/a','http://scontent.fbcdn.net/a','https://user:secret@scontent.fbcdn.net/a'])assert.equal(safePreview(u),null);
});
