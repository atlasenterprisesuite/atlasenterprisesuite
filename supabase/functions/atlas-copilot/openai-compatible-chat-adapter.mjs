const PROFILES=Object.freeze(['fast','balanced','deep']);

function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function clean(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function normalizeBaseUrl(value){const base=clean(value);return base?base.replace(/\/+$/,''):null;}
function contentText(value){
  if(typeof value==='string')return value;
  if(Array.isArray(value))return value.map(part=>typeof part==='string'?part:part?.text?String(part.text):'').filter(Boolean).join('\n');
  try{return JSON.stringify(value);}catch{return String(value??'');}
}
function outputText(data){
  const content=data?.choices?.[0]?.message?.content;
  if(typeof content==='string')return content.trim();
  if(Array.isArray(content))return content.map(part=>part?.text?String(part.text):part?.content?String(part.content):'').filter(Boolean).join('\n').trim();
  return '';
}
function errorForStatus(provider,status){
  if(status===400||status===404)return fail('provider_not_configured',503,{provider});
  if(status===401||status===403)return fail('provider_auth_failed',503,{provider});
  if(status===429)return fail('provider_rate_limited',429,{provider});
  if(status>=500)return fail('provider_unavailable',502,{provider});
  return fail('provider_unavailable',502,{provider});
}
export function createOpenAICompatibleChatAdapter({id,apiKey,baseUrl,models,backend=null,fetchFn=fetch}={}){
  const provider=clean(id);
  if(!provider)throw new TypeError('provider_id_required');
  const base=normalizeBaseUrl(baseUrl);
  const resolved=Object.freeze({fast:clean(models?.fast),balanced:clean(models?.balanced),deep:clean(models?.deep)});
  const configured=Boolean(apiKey&&base)&&Object.values(resolved).some(Boolean);
  const descriptor=()=>({
    id:provider,
    configured,
    verified:false,
    capabilities:['generation','reasoning'],
    profiles:[...PROFILES],
    api:'chat-completions',
    backend:backend||provider,
    endpoint:base,
    models:{...resolved},
    feature_support:{streaming:false,tool_calling:false,background:false}
  });
  async function probe({profile='balanced'}={}){
    const model=resolved[profile];
    if(!apiKey||!base||!model)return {configured:false,verified:false,provider,model:model||null,error:'provider_not_configured'};
    let response;
    try{
      response=await fetchFn(`${base}/models`,{headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'}});
    }catch{return {configured:true,verified:false,provider,model,error:'provider_unavailable'};}
    if(!response.ok){const error=errorForStatus(provider,response.status);return {configured:true,verified:false,provider,model,error:error.code};}
    const payload=await response.json().catch(()=>null);
    const available=Array.isArray(payload?.data)?payload.data.some(item=>String(item?.id||'')===model):true;
    return available
      ?{configured:true,verified:true,provider,model,error:null}
      :{configured:true,verified:false,provider,model,error:'provider_verification_required'};
  }
  async function execute({route,instructions,input,max_output_tokens=3000}={}){
    const model=resolved[route?.profile];
    if(!apiKey||!base||!model)throw fail('provider_not_configured',503,{provider});
    const messages=[
      ...(clean(instructions)?[{role:'system',content:String(instructions)}]:[]),
      ...(Array.isArray(input)?input:[]).map(item=>({role:item?.role==='assistant'?'assistant':'user',content:contentText(item?.content)}))
    ];
    let response;
    try{
      response=await fetchFn(`${base}/chat/completions`,{
        method:'POST',
        headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
        body:JSON.stringify({model,messages,max_tokens:max_output_tokens,stream:false})
      });
    }catch{throw fail('provider_unavailable',502,{provider});}
    if(!response.ok)throw errorForStatus(provider,response.status);
    const data=await response.json().catch(()=>({})),text=outputText(data);
    if(!text)throw fail('internal_error',500,{provider});
    return {provider,model:data?.model||model,response_id:data?.id||null,text,capabilities_used:[...(route?.capabilities||['generation'])],usage:data?.usage||{},provenance:[],tool_calls:[]};
  }
  return Object.freeze({descriptor,probe,execute});
}
