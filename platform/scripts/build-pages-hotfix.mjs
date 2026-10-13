// Bundle the shared project registry into the existing Pages service gateway.
// Does not rebuild the frozen static site or replace its fallback deployment.
import {mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('dist/pages-hotfix',{recursive:true});
await build({entryPoints:['pages-hotfix/_worker.js'],outfile:'dist/pages-hotfix/_worker.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});
console.log('Pages gateway built.');
