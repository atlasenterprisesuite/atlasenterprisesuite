const EFFORT=Object.freeze({fast:'low',balanced:'medium',deep:'high'});
const PROFILES=Object.freeze(['fast','balanced','deep']);
const PROMPT_CACHE_TTL='30m';
function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function cleanModel(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function outputText(data){const out=[];for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&part?.text)out.push(String(part.text));return out.join('\n').trim();}
async function sha256Hex(value){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function safetyId(context={}){const raw=`${context.organization_id||'org'}:${context.user_id||'user'}`;return `atlas_${(await sha256Hex(raw)).slice(0,32)}`;}
async function promptCacheKey(context={},route={},model=''){const raw=`${context.organization_id||'org'}:${route.profile||'balanced'}:${model}`;return `atlas_cache_${(await sha256Hex(raw)).slice(0,40)}`;}
async function providerJson(response){let data={};try{data=await response.json()}catch{}return data;}
function errorForStatus(status){if(status===401||status===403)return fail('provider_auth_failed',503,{provider:'openai'});if(status===404)return fail('provider_not_configured',503,{provider:'openai'});if(status===429)return fail('provider_rate_limited',429,{provider:'openai'});if(status>=500)return fail('provider_unavailable',502,{provider:'openai'});return fail('provider_unavailable',502,{provider:'openai'});}
export function createOpenAIResponsesAdapter({apiKey,models,fetchFn=fetch}={}){
  const resolved=Object.freeze({fast:cleanModel(models?.fast),balanced:cleanModel(models?.balanced),deep:cleanModel(models?.deep)});
  const configured=Boolean(apiKey)&&Object.values(resolved).some(Boolean);
  const descriptor=()=>({id:'openai',configured,verified:false,capabilities:['generation','reasoning'],profiles:[...PROFILES],api:'responses',models:{...resolved},prompt_cache:{ttl:PROMPT_CACHE_TTL,tenant_isolated_key:true}});
  async function execute({context,route,instructions,input,max_output_tokens=3000}={}){
    const model=resolved[route?.profile];
    if(!apiKey||!model)throw fail('provider_not_configured',503,{provider:'openai'});
    const headers={authorization:`Bearer ${apiKey}`,'content-type':'application/json','OpenAI-Safety-Identifier':await safetyId(context)};
    const body={
      model,
      instructions,
      input,
      reasoning:{effort:EFFORT[route.profile]||EFFORT.balanced},
      max_output_tokens,
      store:false,
      prompt_cache_key:await promptCacheKey(context,route,model),
      prompt_cache_options:{ttl:PROMPT_CACHE_TTL},
    };
    let response;
    try{response=await fetchFn('https://api.openai.com/v1/responses',{method:'POST',headers,body:JSON.stringify(body)});}catch{throw fail('provider_unavailable',502,{provider:'openai'});}
    if(!response.ok)throw errorForStatus(response.status);
    const data=await providerJson(response),text=outputText(data);
    if(!text)throw fail('internal_error',500,{provider:'openai'});
    return {provider:'openai',model:data.model||model,response_id:data.id||null,text,capabilities_used:[...(route.capabilities||['generation'])],usage:data.usage||{},provenance:[],tool_calls:[]};
  }
  async function probe({profile='balanced'}={}){
    const model=resolved[profile];
    if(!apiKey||!model)return {configured:false,verified:false,provider:'openai',model:model||null,error:'provider_not_configured'};
    let response;
    try{response=await fetchFn(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`,{headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'}});}catch{return {configured:true,verified:false,provider:'openai',model,error:'provider_unavailable'};}
    if(response.ok)return {configured:true,verified:true,provider:'openai',model,error:null};
    const e=errorForStatus(response.status);
    return {configured:true,verified:false,provider:'openai',model,error:e.code};
  }
  return Object.freeze({descriptor,execute,probe});
}
