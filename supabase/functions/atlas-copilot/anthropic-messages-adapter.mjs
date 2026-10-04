const PROFILES=Object.freeze(['fast','balanced','deep']);
const API_VERSION='2023-06-01';
function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function cleanModel(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function errorForStatus(status){if(status===401||status===403)return fail('provider_auth_failed',503,{provider:'anthropic'});if(status===404)return fail('provider_not_configured',503,{provider:'anthropic'});if(status===429)return fail('provider_rate_limited',429,{provider:'anthropic'});if(status>=500)return fail('provider_unavailable',502,{provider:'anthropic'});return fail('provider_unavailable',502,{provider:'anthropic'});}
function contentText(value){if(typeof value==='string')return value;try{return JSON.stringify(value);}catch{return String(value??'');}}
function outputText(data){return (data?.content||[]).map((block)=>block?.type==='text'&&block?.text?String(block.text):'').filter(Boolean).join('\n').trim();}
function headers(apiKey){return {'x-api-key':apiKey,'anthropic-version':API_VERSION,'content-type':'application/json'};}

export function createAnthropicMessagesAdapter({apiKey,models,fetchFn=fetch}={}){
  const resolved=Object.freeze({fast:cleanModel(models?.fast),balanced:cleanModel(models?.balanced),deep:cleanModel(models?.deep)});
  const configured=Boolean(apiKey)&&Object.values(resolved).some(Boolean);
  const descriptor=()=>({id:'anthropic',configured,verified:false,capabilities:['generation','reasoning'],profiles:[...PROFILES],api:'messages',models:{...resolved}});
  async function probe({profile='balanced'}={}){
    const model=resolved[profile];
    if(!apiKey||!model)return {configured:false,verified:false,provider:'anthropic',model:model||null,error:'provider_not_configured'};
    let response;
    try{response=await fetchFn(`https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`,{headers:headers(apiKey)});}catch{return {configured:true,verified:false,provider:'anthropic',model,error:'provider_unavailable'};}
    if(response.ok)return {configured:true,verified:true,provider:'anthropic',model,error:null};
    const error=errorForStatus(response.status);return {configured:true,verified:false,provider:'anthropic',model,error:error.code};
  }
  async function execute({route,instructions,input,max_output_tokens=3000}={}){
    const profile=route?.profile||'balanced';
    const model=resolved[profile];
    if(!apiKey||!model)throw fail('provider_not_configured',503,{provider:'anthropic'});
    const messages=(Array.isArray(input)?input:[]).map((item)=>({role:item?.role==='assistant'?'assistant':'user',content:contentText(item?.content)}));
    let response;
    try{response=await fetchFn('https://api.anthropic.com/v1/messages',{method:'POST',headers:headers(apiKey),body:JSON.stringify({model,system:String(instructions||''),max_tokens:max_output_tokens,messages})});}catch{throw fail('provider_unavailable',502,{provider:'anthropic'});}
    if(!response.ok)throw errorForStatus(response.status);
    const data=await response.json().catch(()=>({}));
    const text=outputText(data);
    if(!text)throw fail('internal_error',500,{provider:'anthropic'});
    return {provider:'anthropic',model:data?.model||model,text,capabilities_used:[...(route?.capabilities||['generation'])],usage:data?.usage||{},provenance:[],tool_calls:[]};
  }
  return Object.freeze({descriptor,probe,execute});
}
