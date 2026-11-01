const PROFILES=Object.freeze(['fast','balanced','deep']);
const THINKING_LEVEL=Object.freeze({fast:'low',balanced:'medium',deep:'high'});
function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function cleanModel(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function errorForStatus(status){if(status===401||status===403)return fail('provider_auth_failed',503,{provider:'gemini'});if(status===404)return fail('provider_not_configured',503,{provider:'gemini'});if(status===429)return fail('provider_rate_limited',429,{provider:'gemini'});if(status>=500)return fail('provider_unavailable',502,{provider:'gemini'});return fail('provider_unavailable',502,{provider:'gemini'});}
function contentText(value){if(typeof value==='string')return value;try{return JSON.stringify(value);}catch{return String(value??'');}}
function outputText(data){return (data?.candidates||[]).flatMap(c=>c?.content?.parts||[]).map(p=>p?.text?String(p.text):'').filter(Boolean).join('\n').trim();}
export function createGeminiAdapter({apiKey,models,fetchFn=fetch}={}){
  const resolved=Object.freeze({fast:cleanModel(models?.fast),balanced:cleanModel(models?.balanced),deep:cleanModel(models?.deep)});
  const configured=Boolean(apiKey)&&Object.values(resolved).some(Boolean);
  const descriptor=()=>({id:'gemini',configured,verified:false,capabilities:['generation','reasoning'],profiles:[...PROFILES],api:'generateContent',models:{...resolved},feature_support:{thinking_levels:['low','medium','high'],streaming:false,tool_calling:false,background:false}});
  async function probe({profile='balanced'}={}){
    const model=resolved[profile];
    if(!apiKey||!model)return {configured:false,verified:false,provider:'gemini',model:model||null,error:'provider_not_configured'};
    let response;
    try{response=await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,{headers:{'x-goog-api-key':apiKey,'content-type':'application/json'}});}catch{return {configured:true,verified:false,provider:'gemini',model,error:'provider_unavailable'};}
    if(response.ok)return {configured:true,verified:true,provider:'gemini',model,error:null};
    const e=errorForStatus(response.status);return {configured:true,verified:false,provider:'gemini',model,error:e.code};
  }
  async function execute({route,instructions,input,max_output_tokens=3000}={}){
    const model=resolved[route?.profile];
    if(!Number.isInteger(max_output_tokens)||max_output_tokens<1||max_output_tokens>8192)throw fail('invalid_input',400,{field:'max_output_tokens'});
    if(!apiKey||!model)throw fail('provider_not_configured',503,{provider:'gemini'});
    const contents=(Array.isArray(input)?input:[]).map(item=>({role:item?.role==='assistant'?'model':'user',parts:[{text:contentText(item?.content)}]}));
    let response;
    try{response=await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'x-goog-api-key':apiKey,'content-type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:String(instructions||'')}]},contents,generationConfig:{maxOutputTokens:max_output_tokens,thinkingConfig:{thinkingLevel:THINKING_LEVEL[route?.profile]||THINKING_LEVEL.balanced}}})});}catch{throw fail('provider_unavailable',502,{provider:'gemini'});}
    if(!response.ok)throw errorForStatus(response.status);
    const data=await response.json().catch(()=>{throw fail('provider_invalid_response',502,{provider:'gemini'});});
    if(!data||!Array.isArray(data.candidates))throw fail('provider_invalid_response',502,{provider:'gemini'});
    if(data.candidates.some(candidate=>candidate?.finishReason&& !['STOP','MAX_TOKENS'].includes(candidate.finishReason)))throw fail('provider_response_blocked',502,{provider:'gemini'});
    if(data.candidates.some(candidate=>(candidate?.content?.parts||[]).some(part=>part?.functionCall)))throw fail('provider_invalid_response',502,{provider:'gemini'});
    const text=outputText(data);
    if(!text)throw fail('provider_invalid_response',502,{provider:'gemini'});
    return {provider:'gemini',model,text,capabilities_used:[...(route?.capabilities||['generation'])],usage:data.usageMetadata||{},provenance:[],tool_calls:[]};
  }
  return Object.freeze({descriptor,probe,execute});
}
