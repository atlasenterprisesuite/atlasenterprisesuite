#!/usr/bin/env node
import { spawn } from 'node:child_process';

const binary=String(process.env.ATLAS_LOCAL_AI_BINARY||'llama-server').trim();
const modelFile=String(process.env.ATLAS_LOCAL_AI_MODEL_FILE||'').trim();
const hfRepo=String(process.env.ATLAS_LOCAL_AI_HF_REPO||'').trim();
const token=String(process.env.ATLAS_LOCAL_AI_TOKEN||'').trim();
const modelAlias=String(process.env.ATLAS_LOCAL_AI_MODEL_ALIAS||'atlas-local-default').trim();
const host=String(process.env.ATLAS_LOCAL_AI_HOST||'127.0.0.1').trim();
const port=String(process.env.ATLAS_LOCAL_AI_PORT||'8080').trim();
const context=String(process.env.ATLAS_LOCAL_AI_CONTEXT||'32768').trim();
const gpuLayers=String(process.env.ATLAS_LOCAL_AI_GPU_LAYERS||'').trim();

if(!token)throw new Error('ATLAS_LOCAL_AI_TOKEN is required');
if(!modelFile&&!hfRepo)throw new Error('ATLAS_LOCAL_AI_MODEL_FILE or ATLAS_LOCAL_AI_HF_REPO is required');
if(!/^\d{2,5}$/.test(port))throw new Error('ATLAS_LOCAL_AI_PORT must be numeric');
if(!/^\d+$/.test(context))throw new Error('ATLAS_LOCAL_AI_CONTEXT must be numeric');

const args=['--host',host,'--port',port,'-c',context,'--jinja','--alias',modelAlias];
if(modelFile)args.push('-m',modelFile);
else args.push('-hf',hfRepo);
if(gpuLayers==='all'||/^-?\d+$/.test(gpuLayers))args.push('-ngl',gpuLayers);

const child=spawn(binary,args,{
  stdio:'inherit',
  env:{...process.env,LLAMA_API_KEY:token},
});
child.on('exit',(code,signal)=>{
  if(signal)process.stderr.write(`ATLAS Local AI stopped by ${signal}\n`);
  process.exitCode=typeof code==='number'?code:1;
});
child.on('error',(error)=>{
  process.stderr.write(`ATLAS Local AI failed to start: ${error?.message||'runtime_error'}\n`);
  process.exitCode=1;
});
