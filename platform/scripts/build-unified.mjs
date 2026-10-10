import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
const browser=await build({entryPoints:['unified/app.js'],bundle:true,write:false,format:'iife',target:'es2022',minify:false});
await writeFile('dist/unified-client.txt',browser.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
await build({entryPoints:['unified/worker.js'],outfile:'dist/unified-worker.js',bundle:true,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:workers','node:crypto'],loader:{'.html':'text','.css':'text','.txt':'text'},legalComments:'none'});
console.log('Unified browser and Worker bundles built.');
