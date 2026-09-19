#!/usr/bin/env node
import http from 'node:http';
import { Readable } from 'node:stream';

const port=Number(process.env.PORT||10000);
const token=String(process.env.ATLAS_SOVEREIGN_FREE_TOKEN||'').trim();
const upstream=String(process.env.ATLAS_SOVEREIGN_FREE_UPSTREAM||'http://127.0.0.1:8081').replace(/\/+$/,'');
const maxBytes=1024*1024;

if(!token)throw new Error('ATLAS_SOVEREIGN_FREE_TOKEN is required');

function send(res,status,body){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
  res.end(JSON.stringify(body));
}

function authorized(req){
  const auth=String(req.headers.authorization||'');
  return auth===`Bearer ${token}`;
}

async function readBody(req){
  const chunks=[];let total=0;
  for await(const chunk of req){
    total+=chunk.length;
    if(total>maxBytes)throw Object.assign(new Error('request_too_large'),{status:413});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://127.0.0.1:${port}`);
    if(url.pathname==='/healthz'){
      const probe=await fetch(`${upstream}/health`,{signal:AbortSignal.timeout(5000)});
      return send(res,probe.ok?200:503,{ok:probe.ok,service:'atlas-sovereign-free',runtime:'llama.cpp',model:process.env.ATLAS_SOVEREIGN_FREE_MODEL_ALIAS||'atlas-sovereign-free'});
    }
    if(!authorized(req))return send(res,401,{ok:false,error:'authentication_required'});
    if(req.method==='GET'&&url.pathname==='/health'){
      const probe=await fetch(`${upstream}/health`,{signal:AbortSignal.timeout(10000)});
      const body=await probe.text();
      res.writeHead(probe.status,{'content-type':probe.headers.get('content-type')||'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});
      return res.end(body);
    }
    if(req.method!=='POST'||url.pathname!=='/v1/responses')return send(res,404,{ok:false,error:'not_found'});
    const body=await readBody(req);
    const response=await fetch(`${upstream}/v1/responses`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body,
      signal:AbortSignal.timeout(120000)
    });
    res.writeHead(response.status,{
      'content-type':response.headers.get('content-type')||'application/json',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff',
      'x-atlas-runtime':'sovereign-free'
    });
    if(response.body)Readable.fromWeb(response.body).pipe(res); else res.end();
  }catch(error){
    const status=Number(error?.status)||502;
    send(res,status,{ok:false,error:status===413?'request_too_large':'runtime_unavailable'});
  }
});

server.listen(port,'0.0.0.0',()=>process.stdout.write(`ATLAS Sovereign Free relay listening on ${port}\n`));
