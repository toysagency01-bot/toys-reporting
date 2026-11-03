import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,testWorker} from './fixture.mjs';
import {roleBrowserFixture} from './roles-browser-fixture.mjs';
import {seedWiki} from './wiki-fixture.mjs';

const worker=await testWorker(),base='/api/v2/master/wiki';
function setup(){const f=fixture(),tokens=roleBrowserFixture(f.env,f.db);seedWiki(f.db);return {...f,call:(role,path=base,{method='GET',body,origin='https://test.local'}={})=>worker.fetch(new Request('https://test.local'+path,{method,headers:{...(tokens[role]?{cookie:'__Host-toys_session='+tokens[role]}:{}),origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),f.env)};}

test('WIKI is private to current admin/team roles, including a teammate without assigned projects',async()=>{
 const {db,call}=setup();try{
  for(const role of ['admin','team','empty']){const r=await call(role);assert.equal(r.status,200);const d=await r.json();assert.equal(d.pages.length,4);assert.equal(d.canEdit,role==='admin');assert.ok(d.pages.every(p=>!('body'in p)));assert.equal((await call(role,base+'/pages/testing')).status,200);}
  for(const role of ['client','anonymous']){assert.ok([401,403].includes((await call(role)).status));assert.ok([401,403].includes((await call(role,base+'/pages/testing')).status));assert.ok([401,403].includes((await call(role,base+'?q=Уникальная')).status));}
  const search=await(await call('team',base+'?q='+encodeURIComponent('уНИКАЛЬНАЯ'))).json();assert.deepEqual(search.results.map(p=>p.id),['testing']);
  for(const role of ['team','empty','client']){assert.equal((await call(role,base+'/pages/testing',{method:'PUT',body:{version:1,title:'Changed',body:'Changed'}})).status,403);assert.equal((await call(role,base+'/pages/testing/history')).status,403);}
  assert.equal(db.prepare('SELECT version FROM wiki_pages WHERE id=?').get('testing').version,1);
 }finally{db.close();}
});

test('admin edits persist full text, keep revisions and reject stale writes and cross-origin changes',async()=>{
 const {db,call}=setup();try{
  const path=base+'/pages/testing',body={version:1,title:'Обновлённая инструкция',body:'# Новый заголовок\n\nВесь текст **сохранён**.\n\n[Ссылка](https://example.com)'};
  assert.equal((await call('admin',path,{method:'PUT',body,origin:'https://evil.example'})).status,403);
  assert.equal((await call('admin',path,{method:'PUT',body,origin:''})).status,403);
  const saved=await(await call('admin',path,{method:'PUT',body})).json();assert.equal(saved.page.version,2);assert.equal(saved.page.body,body.body);
  assert.equal((await call('admin',path,{method:'PUT',body:{...body,body:'Stale text'}})).status,409);
  assert.equal((await call('admin',path,{method:'PUT',body:{version:2,title:' ',body:'content'}})).status,400);
  assert.equal((await call('admin',path,{method:'PUT',body:{version:2,title:'Title',body:'x'.repeat(65537)}})).status,413);
  const team=await(await call('team',path)).json();assert.equal(team.page.title,body.title);assert.equal(team.page.body,body.body);
  const versions=await(await call('admin',path+'/history')).json();assert.deepEqual(versions.revisions.map(r=>r.version),[2,1]);
  const old=await(await call('admin',path+'/history/1')).json();assert.match(old.revision.body,/Уникальная методика/);
  assert.equal((await call('admin',path,{method:'PUT',body:{version:2,title:body.title,body:body.body}})).status,200);
  assert.equal(db.prepare('SELECT count(*) AS n FROM wiki_revisions').get().n,5);
  assert.equal(db.prepare("SELECT count(*) AS n FROM audit_log WHERE entity_type='wiki'").get().n,1);
  db.prepare("UPDATE platform_user_roles SET role='admin' WHERE user_id='role-empty'").run();
  db.prepare("UPDATE platform_user_roles SET role='team' WHERE user_id='role-admin'").run();
  assert.equal((await call('admin',path,{method:'PUT',body:{...body,version:2}})).status,403);
  db.prepare("UPDATE users SET status='disabled' WHERE id='role-team'").run();assert.equal((await call('team',path)).status,401);
 }finally{db.close();}
});
