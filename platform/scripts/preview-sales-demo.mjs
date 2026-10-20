// Local preview only. Synthetic test credentials never authorize deployed services.
import {fixture,testWorker} from '../recovery-tests/fixture.mjs';
import {readFileSync} from 'node:fs';
import http from 'node:http';
const worker=await testWorker();
const {db,env}=fixture();
db.exec(readFileSync('dist/sales-demo/import.sql','utf8'));
env.MVP_EDITOR_PROJECTS+=',nova-sales-demo,__master';
env.MVP_VIEW_PROJECTS=env.MVP_EDITOR_PROJECTS;
env.MVP_AS_OF_DATE='2026-10-20';
http.createServer(async(req,res)=>{
 try{
  const chunks=[];for await(const c of req)chunks.push(c);
  const body=Buffer.concat(chunks),headers={...req.headers,authorization:'Bearer synthetic-local-editor-token'};
  const request=new Request('http://127.0.0.1:4175'+req.url,{method:req.method,headers,...(body.length?{body}: {})});
  const response=await worker.fetch(request,env,{waitUntil:p=>p.catch(()=>{})});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e);res.writeHead(500);res.end('Local synthetic preview error');}
}).listen(4175,'127.0.0.1',()=>console.log('Synthetic sales demo: http://127.0.0.1:4175/nova-sales-demo/'));
