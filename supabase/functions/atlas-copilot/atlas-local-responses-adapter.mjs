const PROFILES=Object.freeze(['fast','balanced','deep']);
function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function clean(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function normalizeBase(value,{allowInsecure=false}={}){
  const raw=clean(value);
  if(!raw)return null;
  let url;
  try{url=new URL(raw);}catch{return null;}
  if(url.username||url.password)return null;
  if(url.protocol!=='https:'&&!(allowInsecure&&url.protocol==='http:'))return null;
  return url.toString().replace(/\/+$/,'');
}
function outputText(data){
  const parts=[];
  for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&part?.text)parts.push(String(part.text));
  if(parts.length)return parts.join('\n').trim();
  if(typeof data?.output_text==='string')return data.output_text.trim();
  return '';
}
function errorForStatus(status){
  if(status===401||status===403)return fail('provider_auth_failed',503,{provider:'atlas-local'});
  if(status===404)return fail('provider_not_configured',503,{provider:'atlas-local'});
  if(status===429)return fail('provider_rate_limited',429,{provider:'atlas-local'});
  if(status>=500)return fail('provider_unavailable',502,{provider:'atlas-local'});
  return fail('provider_unavailable',502,{provider:'atlas-local'});
}
export function createAtlasLocalResponsesAdapter({baseUrl,token='',models,allowUnauthenticated=false,allowInsecure=false,fetchFn=fetch,timeoutMs=120000}={}){
  const base=normalizeBase(baseUrl,{allowInsecure});
  const resolved=Object.freeze({fast:clean(models?.fast),balanced:clean(models?.balanced),deep:clean(models?.deep)});
  const configured=Boolean(base)&&Object.values(resolved).some(Boolean)&&Boolean(token||allowUnauthenticated);
  const authHeaders=()=>token?{authorization:`Bearer ${token}`}:{};
  const descriptor=()=>({
    id:'atlas-local',
    configured,
    verified:false,
    capabilities:['generation','reasoning'],
    profiles:[...PROFILES],
    api:'responses-compatible',
    backend:'self-hosted',
    endpoint:'atlas-local-runtime',
    models:{...resolved},
    feature_support:{
      local_inference:true,
      responses_api:true,
      streaming:false,
      tool_calling:false,
      computer_use:false,
      mid_turn_steering:false
    }
  });
  async function probe({profile='balanced'}={}){
    const model=resolved[profile];
    if(!configured||!model)return {configured:false,verified:false,provider:'atlas-local',model:model||null,error:'provider_not_configured'};
    let response;
    try{
      response=await fetchFn(`${base}/health`,{headers:{...authHeaders(),'content-type':'application/json'},signal:AbortSignal.timeout(Math.min(timeoutMs,15000))});
    }catch{return {configured:true,verified:false,provider:'atlas-local',model,error:'provider_unavailable'};}
    if(response.ok)return {configured:true,verified:true,provider:'atlas-local',model,error:null};
    const error=errorForStatus(response.status);
    return {configured:true,verified:false,provider:'atlas-local',model,error:error.code};
  }
  async function execute({route,instructions,input,max_output_tokens=3000}={}){
    const profile=route?.profile||'balanced';
    const model=resolved[profile];
    if(!configured||!model)throw fail('provider_not_configured',503,{provider:'atlas-local'});
    const profileInstruction=profile==='deep'
      ? 'Use the deepest available local reasoning budget and verify important conclusions before answering.'
      : profile==='fast'
        ? 'Prefer a fast, concise local answer unless more reasoning is required for correctness.'
        : 'Use a balanced local reasoning budget.';
    const body={model,instructions:`${String(instructions||'')}\n\nATLAS LOCAL RUNTIME PROFILE: ${profileInstruction}`.trim(),input:Array.isArray(input)?input:[],max_output_tokens,store:false};
    let response;
    try{
      response=await fetchFn(`${base}/v1/responses`,{method:'POST',headers:{...authHeaders(),'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)});
    }catch{throw fail('provider_unavailable',502,{provider:'atlas-local'});}
    if(!response.ok)throw errorForStatus(response.status);
    const data=await response.json().catch(()=>({}));
    const text=outputText(data);
    if(!text)throw fail('internal_error',500,{provider:'atlas-local'});
    return {provider:'atlas-local',model:data?.model||model,response_id:data?.id||null,text,capabilities_used:[...(route?.capabilities||['generation'])],usage:data?.usage||{},provenance:[],tool_calls:[]};
  }
  return Object.freeze({descriptor,probe,execute});
}
