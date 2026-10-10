import http from 'node:http';
import {fixture,testWorker} from './fixture.mjs';
const worker=await testWorker();const{env}=fixture();
http.createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const headers={...req.headers,authorization:'Bearer synthetic-local-editor-token'};const r=await worker.fetch(new Request('http://127.0.0.1:4173'+req.url,{method:req.method,headers,...(body.length?{body}: {})}),env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch(e){console.error(e);res.writeHead(500);res.end('Test server error');}}).listen(4173,'127.0.0.1');
