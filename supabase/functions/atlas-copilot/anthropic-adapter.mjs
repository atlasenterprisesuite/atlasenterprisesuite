const PROFILES=Object.freeze(['fast','balanced','deep']);
const EFFORT=Object.freeze({fast:'low',balanced:'medium',deep:'high'});
const API_VERSION='2023-06-01';

function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function clean(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function contentText(value){
  if(typeof value==='string')return value;
  if(Array.isArray(value))return value.map(part=>typeof part==='string'?part:part?.text?String(part.text):'').filter(Boolean).join('\n');
  try{return JSON.stringify(value);}catch{return String(value??'');}
}
function outputText(data){return (data?.content||[]).filter(part=>part?.type==='text'&&part?.text).map(part=>String(part.text)).join('\n').trim();}
function errorForStatus(status){
  if(status===400||status===404)return fail('provider_not_configured',503,{provider:'anthropic'});
  if(status===401||status===403)return fail('provider_auth_failed',503,{provider:'anthropic'});
  if(status===429)return fail('provider_rate_limited',429,{provider:'anthropic'});
  if(status>=500)return fail('provider_unavailable',502,{provider:'anthropic'});
  return fail('provider_unavailable',502,{provider:'anthropic'});
}
export function createAnthropicAdapter({apiKey,models,fetchFn=fetch}={}){
  const resolved=Object.freeze({fast:clean(models?.fast),balanced:clean(models?.balanced),deep:clean(models?.deep)});
  const configured=Boolean(apiKey)&&Object.values(resolved).some(Boolean);
  const headers=()=>({'x-api-key':apiKey,'anthropic-version':API_VERSION,'content-type':'application/json'});
  const descriptor=()=>({
    id:'anthropic',
    configured,
    verified:false,
    capabilities:['generation','reasoning'],
    profiles:[...PROFILES],
    api:'messages',
    backend:'anthropic',
    endpoint:'https://api.anthropic.com',
    models:{...resolved},
    feature_support:{prompt_caching:true,structured_outputs:true,tool_calling:false,background:false}
  });
  async function probe({profile='balanced'}={}){
    const model=resolved[profile];
    if(!apiKey||!model)return {configured:false,verified:false,provider:'anthropic',model:model||null,error:'provider_not_configured'};
    let response;
    try{response=await fetchFn(`https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`,{headers:headers()});}
    catch{return {configured:true,verified:false,provider:'anthropic',model,error:'provider_unavailable'};}
    if(response.ok)return {configured:true,verified:true,provider:'anthropic',model,error:null};
    const error=errorForStatus(response.status);
    return {configured:true,verified:false,provider:'anthropic',model,error:error.code};
  }
  async function execute({route,instructions,input,max_output_tokens=3000}={}){
    const model=resolved[route?.profile];
    if(!apiKey||!model)throw fail('provider_not_configured',503,{provider:'anthropic'});
    const messages=(Array.isArray(input)?input:[]).map(item=>({role:item?.role==='assistant'?'assistant':'user',content:contentText(item?.content)}));
    let response;
    try{
      response=await fetchFn('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:headers(),
        body:JSON.stringify({
          model,
          system:String(instructions||''),
          messages,
          max_tokens:max_output_tokens,
          stream:false,
          output_config:{effort:EFFORT[route?.profile]||EFFORT.balanced}
        })
      });
    }catch{throw fail('provider_unavailable',502,{provider:'anthropic'});}
    if(!response.ok)throw errorForStatus(response.status);
    const data=await response.json().catch(()=>({})),text=outputText(data);
    if(!text)throw fail('internal_error',500,{provider:'anthropic'});
    return {provider:'anthropic',model:data?.model||model,response_id:data?.id||null,text,capabilities_used:[...(route?.capabilities||['generation'])],usage:data?.usage||{},provenance:[],tool_calls:[]};
  }
  return Object.freeze({descriptor,probe,execute});
}
