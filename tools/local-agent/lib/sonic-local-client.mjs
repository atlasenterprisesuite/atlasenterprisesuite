import { localInferenceEndpoint } from './local-core-client.mjs';

const model = 'acestep-v15-turbo';
const taskPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const int = (v,min,max) => Number.isInteger(v) && v>=min && v<=max;
function textField(v,max) {
  if (typeof v !== 'string' || !v.trim() || v.length > max || /[\u0000-\u001f\u007f]/.test(v)) throw Error('sonic_invalid_text');
  return v.trim();
}
function connection(options) {
  if (options.approvedLocalRuntime !== true) throw Error('sonic_runtime_approval_required');
  const url = localInferenceEndpoint(options.endpoint ?? 'http://127.0.0.1:8001');
  // Numeric loopback only: no DNS resolution or remote runtime fallback.
  if (!['127.0.0.1','[::1]'].includes(url.hostname)) throw Error('sonic_numeric_loopback_only');
  if (typeof options.token !== 'string' || !options.token.trim() || options.token.length>512 || /[\r\n]/.test(options.token)) throw Error('sonic_token_required');
  return url.origin;
}
async function request(options,route,body) {
  const origin=connection(options);
  let response;
  try {
    response=await (options.fetchImpl ?? fetch)(new URL(route,origin),{
      method:'POST', headers:{'content-type':'application/json',authorization:'Bearer '+options.token},
      body:JSON.stringify(body),redirect:'error',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)
    });
  } catch { throw Error('sonic_runtime_unreachable'); }
  if (!response.ok || response.redirected) throw Error('sonic_http_failure');
  if (!response.body) throw Error('sonic_invalid_response');
  const reader=response.body.getReader();
  const chunks=[]; let length=0;
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done) break;
      length+=value.byteLength;
      if(length>131072) throw Error('sonic_response_too_large');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(()=>{}); }
  let data;
  try { data=JSON.parse(Buffer.concat(chunks,length).toString('utf8')); }
  catch { throw Error('sonic_invalid_response'); }
  if(data?.code!==200 || data.error!=null) throw Error('sonic_provider_failure');
  return data.data;
}
export async function startSonicJob(options) {
  const s=options.spec;
  if(!s || !int(s.duration,10,30) || !int(s.bpm,60,180) || !int(s.seed,0,2147483647)) throw Error('sonic_invalid_spec');
  const genre=textField(s.genre,80), instruments=textField(s.instruments,160), prompt=textField(s.prompt,1000);
  if(typeof s.key!=='string' || !/^[A-G](#|b)? (Major|Minor)$/.test(s.key)) throw Error('sonic_invalid_key');
  const data=await request(options,'/release_task',{
    task_type:'text2music',model,prompt:genre+'; '+instruments+'; '+prompt,
    lyrics:'[Instrumental]',audio_format:'wav',audio_duration:s.duration,bpm:s.bpm,
    key_scale:s.key,time_signature:'4',seed:s.seed,use_random_seed:false,
    thinking:false,use_format:false,use_cot_caption:false,use_cot_language:false,
    inference_steps:8,batch_size:1
  });
  if(typeof data?.task_id!=='string' || !taskPattern.test(data.task_id)) throw Error('sonic_invalid_task');
  return {taskId:data.task_id,state:'submitted',audioVerified:false};
}
export async function querySonicJob(options) {
  if(typeof options.taskId!=='string' || !taskPattern.test(options.taskId)) throw Error('sonic_invalid_task');
  const data=await request(options,'/query_result',{task_id_list:[options.taskId]});
  if(!Array.isArray(data) || data.length!==1 || data[0]?.task_id!==options.taskId || ![0,1,2].includes(data[0].status)) throw Error('sonic_invalid_status');
  return {taskId:options.taskId,state:['pending','reported-success','failed'][data[0].status],audioVerified:false};
}
