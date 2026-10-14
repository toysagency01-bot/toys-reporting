import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pages from '../dist/pages-hotfix/_worker.js';
import registry from '../projects.json' with {type:'json'};
import {build} from 'esbuild';

test('deployable Pages bundle matches the current gateway and project registry', async () => {
  const expected = await build({
    entryPoints:['pages-hotfix/_worker.js'], outfile:'dist/pages-hotfix/_worker.js',
    bundle:true, format:'esm', platform:'browser', target:'es2022', write:false,
  });
  assert.equal(await readFile('dist/pages-hotfix/_worker.js', 'utf8'), expected.outputFiles[0].text,
    'Stale Pages gateway: run npm run pages:gateway:build and deploy it with project publication.');
});

test('deployable gateway routes every registered dashboard and its query assets', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Registered project reached the frozen legacy site'); };
  try {
    for (const slug of Object.keys(registry)) {
      for (const path of [`/${slug}`, `/${slug}/`, `/${slug}/index.html`, `/mvp/${slug}/`]) {
        let forwarded;
        const response = await pages.fetch(new Request(`https://reports.toys-agency.com${path}?ui=core%2Fcore.js`, {
          headers:{cookie:'synthetic-session'},
        }), {STAGING_MVP:{fetch:async request => {
          forwarded = request;
          return new Response('current-platform');
        }}});
        assert.equal(response.status, 200, path);
        assert.equal(response.headers.get('x-toys-pages-route'), 'native-board-v1');
        assert.equal(await response.text(), 'current-platform');
        assert.equal(new URL(forwarded.url).pathname, `/api/v2/projects/${slug}/board`);
        assert.equal(new URL(forwarded.url).searchParams.get('ui'), 'core/core.js');
        assert.equal(forwarded.headers.get('cookie'), 'synthetic-session');
      }
    }
  } finally {
    globalThis.fetch = previousFetch;
  }
});
