import { startSonicJob, querySonicJob } from './lib/sonic-local-client.mjs';

async function main() {
  const action=process.argv[2];
  if(!['submit','status'].includes(action) || process.argv.length!==3) throw Error('sonic_invalid_action');
  const options={
    endpoint:process.env.ATLAS_SONIC_ENDPOINT ?? 'http://127.0.0.1:8001',
    token:process.env.ATLAS_SONIC_TOKEN,
    approvedLocalRuntime:process.env.ATLAS_SONIC_RUNTIME_APPROVED==='true'
  };
  let length=0;
  const chunks=[];
  for await (const chunk of process.stdin) {
    length+=chunk.byteLength;
    if(length>8192) throw Error('sonic_input_too_large');
    chunks.push(chunk);
  }
  let input;
  try { input=JSON.parse(Buffer.concat(chunks,length).toString('utf8')); }
  catch { throw Error('sonic_invalid_input'); }
  if (!input || typeof input!=='object' || Array.isArray(input)) throw Error('sonic_invalid_input');
  const result=action==='submit'
    ? await startSonicJob({...options,spec:input})
    : await querySonicJob({...options,taskId:input.taskId});
  process.stdout.write(JSON.stringify(result)+'\n');
}
main().catch(error=>{
  const code=typeof error?.message==='string' && /^sonic_[a-z_]+$/.test(error.message) ? error.message : 'sonic_execution_blocked';
  process.stderr.write(JSON.stringify({error:code})+'\n');
  process.exitCode=1;
});
