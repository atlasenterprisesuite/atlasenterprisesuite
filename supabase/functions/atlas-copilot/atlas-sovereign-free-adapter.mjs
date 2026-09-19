const PROFILES=Object.freeze(['fast','balanced','deep']);
function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function clean(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function normalizeBase(value){
  const raw=clean(value);
  if(!raw)return null;
  let url;
  try{url=new URL(raw);}catch{return null;}
  if(url.username||url.password||url.protocol!=='https:')return null;
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
  if(status===401||status===403)return fail('provider_auth_failed',503,{provider:'atlas-sovereign-free'});
  if(status===404)return fail('provider_not_configured',503,{provider:'atlas-sovereign-free'});
  if(status===429)return fail('provider_rate_limited',429,{provider:'atlas-sovereign-free'});
  return fail('provider_unavailable',502,{provider:'atlas-sovereign-free'});
}
export function createAtlasSovereignFreeAdapter({baseUrl,token='',models,state='not_configured',fetchFn=fetch,timeoutMs=120000}={}){
  const base=normalizeBase(baseUrl);
  const resolved=Object.freeze({fast:clean(models?.fast),balanced:clean(models?.balanced),deep:clean(models?.deep)});
  const configured=Boolean(base&&token&&Object.values(resolved).some(Boolean));
  const trustedVerified=state==='verified';
  const descriptor=()=>({
    id:'atlas-sovereign-free',
    configured,
    verified:trustedVerified,
    capabilities:['generation','reasoning'],
    profiles:[...PROFILES],
    api:'responses-compatible',
    backend:'render-free-llama',
    endpoint:'atlas-sovereign-free-runtime',
    models:{...resolved},
    feature_support:{
      sovereign_inference:true,
      responses_api:true,
      streaming:false,
      tool_calling:false,
      computer_use:false,
      mid_turn_steering:false
    }
  });
  async function probe({profile='balanced'}={}){
    const model=resolved[profile];
    if(!configured||!model)return {configured:false,verified:false,provider:'atlas-sovereign-free',model:model||null,error:'provider_not_configured'};
    if(!trustedVerified)return {configured:true,verified:false,provider:'atlas-sovereign-free',model,error:'provider_verification_required'};
    return {configured:true,verified:true,provider:'atlas-sovereign-free',model,error:null};
  }
  async function execute({route,instructions,input,max_output_tokens=1800}={}){
    const profile=route?.profile||'balanced';
    const model=resolved[profile];
    if(!configured||!model)throw fail('provider_not_configured',503,{provider:'atlas-sovereign-free'});
    if(!trustedVerified)throw fail('provider_verification_required',503,{provider:'atlas-sovereign-free'});
    const body={
      model,
      instructions:String(instructions||''),
      input:Array.isArray(input)?input:[],
      max_output_tokens:Math.min(Number(max_output_tokens)||1800,1800),
      store:false
    };
    let response;
    try{
      response=await fetchFn(`${base}/v1/responses`,{
        method:'POST',
        headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
        body:JSON.stringify(body),
        signal:AbortSignal.timeout(timeoutMs)
      });
    }catch{throw fail('provider_unavailable',502,{provider:'atlas-sovereign-free'});}
    if(!response.ok)throw errorForStatus(response.status);
    const data=await response.json().catch(()=>({}));
    const text=outputText(data);
    if(!text)throw fail('internal_error',500,{provider:'atlas-sovereign-free'});
    return {provider:'atlas-sovereign-free',model:data?.model||model,response_id:data?.id||null,text,capabilities_used:[...(route?.capabilities||['generation'])],usage:data?.usage||{},provenance:[],tool_calls:[]};
  }
  return Object.freeze({descriptor,probe,execute});
}
