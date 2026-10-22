import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {PDFDocument} from 'pdf-lib';
test('invoice PDF generation and Unicode subsetting run inside a real Cloudflare Worker',async()=>{
 const source=`import {invoicePDF} from './documents/pdf.js';export default {async fetch(){const bytes=await invoicePDF({number:'INV-2026-0001',data:{issuer:'TOYS Agency\\nИван Иванов',customer:'Клиент / Česká republika',payment:'IBAN TEST',language:'ru',currency:'EUR',status:'issued',date:'2026-10-22',dueDate:'2026-11-05',notes:'Спасибо за сотрудничество',tax:'20',discount:'0',lines:[{description:'Ведение рекламы',quantity:'1',price:'1000'}]}});return new Response(bytes,{headers:{'content-type':'application/pdf'}});}}`;
 const result=await build({stdin:{contents:source,resolveDir:resolve('.')},bundle:true,write:false,format:'esm',platform:'browser',loader:{'.txt':'text'},external:['node:crypto']});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],script:result.outputFiles[0].text}));
 try{const response=await mf.dispatchFetch('http://local/');assert.equal(response.status,200);const pdf=await PDFDocument.load(await response.arrayBuffer());assert.equal(pdf.getPageCount(),1);}finally{await mf.dispose();}
});
