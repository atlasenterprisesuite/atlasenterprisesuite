const PROFILES=Object.freeze(['fast','balanced','deep']);
const DEFAULT_MODELS=Object.freeze({fast:'auto:fast',balanced:'auto',deep:'auto:smart'});
function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function clean(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function normalizeBase(value,{allowInsecure=false}={}){
  const raw=clean(value);
  if(!raw)return null;
  let url;
  try{url=new URL(raw);}catch{return null;}
  if(url.username||url.password)return null;
  if(url.protocol!=='https:'&&!(allowInsecure&&url.protocol==='http:'))return null;
  url.pathname=url.pathname.replace(/\/v1\/?$/,'').replace(/\/$/,'');
  return url.toString().replace(/\/$/,'');
}
function outputText(data){
  const parts=[];
  const output=Array.isArray(data?.output)?data.output:[];
  for(const item of output){
    const content=Array.isArray(item?.content)?item.content:[];
    for(const part of content)if(part?.type==='output_text'&&part?.text)parts.push(String(part.text));
  }
  if(parts.length)return parts.join('\n').trim();
  if(typeof data?.output_text==='string')return data.output_text.trim();
  const choices=Array.isArray(data?.choices)?data.choices:[];
  const chat=choices[0]?.message?.content;
  return typeof chat==='string'?chat.trim():'';
}
function errorForStatus(status){
  if(status===401||status===403)return fail('provider_auth_failed',503,{provider:'freellmapi'});
  if(status===404)return fail('provider_not_configured',503,{provider:'freellmapi'});
  if(status===402||status===429)return fail('provider_rate_limited',429,{provider:'freellmapi'});
  if(status>=500)return fail('provider_unavailable',502,{provider:'freellmapi'});
  return fail('provider_unavailable',502,{provider:'freellmapi'});
}
function routedVia(response){
  const raw=clean(response?.headers?.get?.('x-routed-via'));
  if(!raw)return null;
  const bounded=raw.slice(0,160);
  return /^[A-Za-z0-9._:/+@ -]+$/.test(bounded)?bounded:null;
}
export function createFreeLLMAPIAdapter({
  enabled=false,
  baseUrl,
  apiKey='',
  models,
  allowInsecure=false,
  fetchFn=fetch,
  timeoutMs=150000,
  probeTimeoutMs=10000,
}={}){
  const base=normalizeBase(baseUrl,{allowInsecure});
  const resolved=Object.freeze({
    fast:clean(models?.fast)||DEFAULT_MODELS.fast,
    balanced:clean(models?.balanced)||DEFAULT_MODELS.balanced,
    deep:clean(models?.deep)||DEFAULT_MODELS.deep,
  });
  const configured=enabled===true&&Boolean(base)&&Boolean(clean(apiKey));
  const authHeaders=()=>({authorization:`Bearer ${apiKey}`,'content-type':'application/json'});
  const descriptor=()=>({
    id:'freellmapi',
    configured,
    verified:false,
    capabilities:['generation','reasoning'],
    profiles:[...PROFILES],
    api:'responses-compatible',
    backend:'external-router',
    endpoint:'freellmapi',
    models:{...resolved},
    feature_support:{
      responses_api:true,
      upstream_failover:true,
      adaptive_ttfb_budget:true,
      aggregate_router:true,
      production_supported:false,
      tool_calling:false,
      streaming:false,
    }
  });
  async function probe({profile='balanced'}={}){
    const model=resolved[profile];
    if(!configured||!model)return {configured:false,verified:false,provider:'freellmapi',model:model||null,error:'provider_not_configured'};
    let response;
    try{
      response=await fetchFn(`${base}/v1/models`,{
        method:'GET',
        headers:authHeaders(),
        signal:AbortSignal.timeout(Math.max(1000,Math.min(Number(probeTimeoutMs)||10000,30000))),
      });
    }catch{return {configured:true,verified:false,provider:'freellmapi',model,error:'provider_unavailable'};}
    if(response.ok)return {configured:true,verified:true,provider:'freellmapi',model,error:null};
    const error=errorForStatus(response.status);
    return {configured:true,verified:false,provider:'freellmapi',model,error:error.code};
  }
  async function execute({route,instructions,input,max_output_tokens=3000}={}){
    const profile=route?.profile||'balanced';
    const model=resolved[profile];
    if(!configured||!model)throw fail('provider_not_configured',503,{provider:'freellmapi'});
    const body={model,instructions,input:Array.isArray(input)?input:[],max_output_tokens:Math.max(64,Math.min(3000,Number(max_output_tokens)||3000)),store:false,stream:false};
    let response;
    try{
      response=await fetchFn(`${base}/v1/responses`,{
        method:'POST',
        headers:authHeaders(),
        body:JSON.stringify(body),
        signal:AbortSignal.timeout(Math.max(30000,Math.min(Number(timeoutMs)||150000,300000))),
      });
    }catch{throw fail('provider_unavailable',502,{provider:'freellmapi'});}
    if(!response.ok)throw errorForStatus(response.status);
    const data=await response.json().catch(()=>({}));
    const text=outputText(data);
    if(!text)throw fail('provider_unavailable',502,{provider:'freellmapi'});
    const upstream=routedVia(response);
    return {
      provider:'freellmapi',
      model:data?.model||model,
      response_id:data?.id||null,
      text,
      capabilities_used:[...(route?.capabilities||['generation'])],
      usage:{...(data?.usage||{}),...(upstream?{atlas_routed_via:upstream}:{})},
      provenance:[],
      tool_calls:[],
    };
  }
  return Object.freeze({descriptor,probe,execute});
}
