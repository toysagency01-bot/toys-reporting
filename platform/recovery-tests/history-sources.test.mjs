import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const directory=mkdtempSync(join(tmpdir(),'toys-history-test-'));
await build({stdin:{contents:readFileSync('runtime/backend.js','utf8')+'\nexport {assertPublicTabPrivacy,parseGvizTable,PROJECT_SPECS,HOUSEVIP_PROJECT_TABS};',
 resolveDir:resolve('runtime')},outfile:join(directory,'reader.mjs'),bundle:true,platform:'node',format:'esm',
 plugins:[{name:'cloudflare-test',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cloudflare:workers',namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export class WorkerEntrypoint {}'}));}}]});
const rt=await import(pathToFileURL(join(directory,'reader.mjs')));
rmSync(directory,{recursive:true,force:true});
test('valid report periods pass privacy checks while contacts and invalid ranges remain blocked',()=>{
 for(const date of ['01.09.26 - 30.09.26','01.09.2026 — 30.09.2026'])assert.doesNotThrow(()=>rt.assertPublicTabPrivacy('Report',[[date]]));
 for(const value of ['+420 777 123 456','test@example.com','31.02.26 - 30.09.26','30.09.26 - 01.09.26','Телефон']){
  assert.throws(()=>rt.assertPublicTabPrivacy('Report',[[value]]),error=>error.code==='project_tab_pii');
 }
});
test('empty optional monthly Google report does not block imports; required metrics still do',()=>{
 const spec=rt.PROJECT_SPECS['karlovarska-sul-k4rm'];
 const empty='google.visualization.Query.setResponse({"status":"ok","table":{"cols":[],"rows":[]}});';
 const monthly=spec.projectTabs.find(tab=>tab.gid===1413680168);
 assert.deepEqual(rt.parseGvizTable(empty,monthly),[]);
 assert.throws(()=>rt.parseGvizTable(empty,spec.tables[0]),error=>error.code==='empty_source');
 assert.equal(rt.HOUSEVIP_PROJECT_TABS.has('Тексты / Сторис на октябрь (SMM)'),true);
 assert.equal(rt.HOUSEVIP_PROJECT_TABS.has('ЛИДЫ(Meta)'),false);
 assert.equal(rt.HOUSEVIP_PROJECT_TABS.has('LeadFeedback'),false);
});
