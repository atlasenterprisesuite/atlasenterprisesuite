const EFFORT=Object.freeze({fast:'low',balanced:'medium',deep:'high'});
const PROFILES=Object.freeze(['fast','balanced','deep']);
const ENDPOINTS=Object.freeze(['runtime','mantle']);
const PROMPT_CACHE_TTL='30m';

function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function clean(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function outputText(data){const out=[];for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&part?.text)out.push(String(part.text));return out.join('\n').trim();}
function errorForStatus(status){if(status===401||status===403)return fail('provider_auth_failed',503,{provider:'bedrock'});if(status===404)return fail('provider_not_configured',503,{provider:'bedrock'});if(status===429)return fail('provider_rate_limited',429,{provider:'bedrock'});if(status>=500)return fail('provider_unavailable',502,{provider:'bedrock'});return fail('provider_unavailable',502,{provider:'bedrock'});}
function normalizeEndpoint(value){const endpoint=clean(value)||'runtime';if(!ENDPOINTS.includes(endpoint))throw fail('provider_not_configured',503,{provider:'bedrock'});return endpoint;}
function baseUrlFor({endpoint,region,baseUrl}){const explicit=clean(baseUrl);if(explicit)return explicit.replace(/\/+$/,'');if(endpoint==='mantle')return `https://bedrock-mantle.${region}.api.aws/openai/v1`;return `https://bedrock-runtime.${region}.amazonaws.com/openai/v1`;}

export function createAmazonBedrockResponsesAdapter({apiKey,region='us-west-2',endpoint='runtime',baseUrl,models,runtimeVerified=false,fetchFn=fetch}={}){
  const selectedEndpoint=normalizeEndpoint(endpoint);
  const selectedRegion=clean(region)||'us-west-2';
  const base=baseUrlFor({endpoint:selectedEndpoint,region:selectedRegion,baseUrl});
  const resolved=Object.freeze({fast:clean(models?.fast),balanced:clean(models?.balanced),deep:clean(models?.deep)});
  const configured=Boolean(apiKey)&&Object.values(resolved).some(Boolean);
  const descriptor=()=>({
    id:'bedrock',
    configured,
    verified:false,
    capabilities:['generation','reasoning'],
    profiles:[...PROFILES],
    api:'responses',
    models:{...resolved},
    backend:'amazon-bedrock',
    endpoint:selectedEndpoint,
    region:selectedRegion,
    feature_support:{
      async_tool_calling:false,
      mid_turn_steering:false,
      reasoning_updates:false,
      programmatic_tool_calling:false,
      multi_agent:false,
      remote_mcp:false,
      streaming:true,
      prompt_caching:true,
      computer_use:true
    }
  });

  async function execute({route,instructions,input,max_output_tokens=3000}={}){
    const model=resolved[route?.profile];
    if(!apiKey||!model)throw fail('provider_not_configured',503,{provider:'bedrock'});
    const body={
      model,
      instructions,
      input,
      reasoning:{effort:EFFORT[route.profile]||EFFORT.balanced},
      max_output_tokens,
      store:false,
      prompt_cache_options:{ttl:PROMPT_CACHE_TTL}
    };
    let response;
    try{
      response=await fetchFn(`${base}/responses`,{
        method:'POST',
        headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
        body:JSON.stringify(body)
      });
    }catch{throw fail('provider_unavailable',502,{provider:'bedrock'});}
    if(!response.ok)throw errorForStatus(response.status);
    const data=await response.json().catch(()=>({})),text=outputText(data);
    if(!text)throw fail('internal_error',500,{provider:'bedrock'});
    return {provider:'bedrock',model:data.model||model,response_id:data.id||null,text,capabilities_used:[...(route.capabilities||['generation'])],usage:data.usage||{},provenance:[],tool_calls:[]};
  }

  async function probe({profile='balanced'}={}){
    const model=resolved[profile];
    if(!apiKey||!model)return {configured:false,verified:false,provider:'bedrock',model:model||null,error:'provider_not_configured'};
    if(selectedEndpoint==='runtime'){
      return runtimeVerified
        ? {configured:true,verified:true,provider:'bedrock',model,error:null}
        : {configured:true,verified:false,provider:'bedrock',model,error:'provider_verification_required'};
    }
    let response;
    try{
      response=await fetchFn(`${base}/models/${encodeURIComponent(model)}`,{
        headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'}
      });
    }catch{return {configured:true,verified:false,provider:'bedrock',model,error:'provider_unavailable'};}
    if(response.ok)return {configured:true,verified:true,provider:'bedrock',model,error:null};
    const error=errorForStatus(response.status);
    return {configured:true,verified:false,provider:'bedrock',model,error:error.code};
  }

  return Object.freeze({descriptor,execute,probe});
}
