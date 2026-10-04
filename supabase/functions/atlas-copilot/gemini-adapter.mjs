const PROFILES=Object.freeze(['fast','balanced','deep']);
function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function cleanModel(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function errorForStatus(status){if(status===401||status===403)return fail('provider_auth_failed',503,{provider:'gemini'});if(status===404)return fail('provider_not_configured',503,{provider:'gemini'});if(status===429)return fail('provider_rate_limited',429,{provider:'gemini'});if(status>=500)return fail('provider_unavailable',502,{provider:'gemini'});return fail('provider_unavailable',502,{provider:'gemini'});}
function contentText(value){if(typeof value==='string')return value;try{return JSON.stringify(value);}catch{return String(value??'');}}
function outputParts(data){return (data?.candidates||[]).flatMap(c=>c?.content?.parts||[]);}
function outputText(data){return outputParts(data).map(p=>p?.text?String(p.text):'').filter(Boolean).join('\n').trim();}
function plainObject(value){return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function normalizeTools(rawTools=[]){
  const metadata=new Map(),declarations=[];
  for(const raw of Array.isArray(rawTools)?rawTools:[]){
    const name=typeof raw?.name==='string'?raw.name.trim():'';
    if(!name||metadata.has(name))continue;
    const parameters=plainObject(raw?.parameters)?structuredClone(raw.parameters):{type:'object',properties:{}};
    declarations.push({name,description:String(raw?.description||''),parameters});
    metadata.set(name,{risk_class:String(raw?.risk_class||'read-only'),required_permissions:Array.isArray(raw?.required_permissions)?[...new Set(raw.required_permissions.map(String))]:[],side_effect:String(raw?.side_effect||'none'),cost_class:String(raw?.cost_class||'none')});
  }
  return {metadata,declarations};
}
function normalizeFunctionCalls(data,toolMetadata){
  const calls=[];
  for(const part of outputParts(data)){
    const fc=part?.functionCall;
    if(!fc)continue;
    const name=typeof fc?.name==='string'?fc.name.trim():'';
    const meta=toolMetadata.get(name);
    if(!name||!meta||!plainObject(fc?.args))throw fail('provider_invalid_tool_call',502,{provider:'gemini'});
    calls.push({tool_name:name,arguments:structuredClone(fc.args),risk_class:meta.risk_class,required_permissions:[...meta.required_permissions],side_effect:meta.side_effect,cost_class:meta.cost_class,provider:'gemini',provider_call_id:typeof fc?.id==='string'&&fc.id.trim()?fc.id.trim():null});
  }
  return calls;
}
export function createGeminiAdapter({apiKey,models,fetchFn=fetch}={}){
  const resolved=Object.freeze({fast:cleanModel(models?.fast),balanced:cleanModel(models?.balanced),deep:cleanModel(models?.deep)});
  const configured=Boolean(apiKey)&&Object.values(resolved).some(Boolean);
  const descriptor=()=>({id:'gemini',configured,verified:false,capabilities:['generation','reasoning'],profiles:[...PROFILES],api:'generateContent',models:{...resolved},feature_support:{background:false,multi_agent:false,computer_use:false,function_calling:true,remote_mcp:false,programmatic_tool_calling:false,dynamic_workflows:false}});
  async function probe({profile='balanced'}={}){
    const model=resolved[profile];
    if(!apiKey||!model)return {configured:false,verified:false,provider:'gemini',model:model||null,error:'provider_not_configured'};
    let response;
    try{response=await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,{headers:{'x-goog-api-key':apiKey,'content-type':'application/json'}});}catch{return {configured:true,verified:false,provider:'gemini',model,error:'provider_unavailable'};}
    if(response.ok)return {configured:true,verified:true,provider:'gemini',model,error:null};
    const e=errorForStatus(response.status);return {configured:true,verified:false,provider:'gemini',model,error:e.code};
  }
  async function execute({route,instructions,input,max_output_tokens=3000,tools=[]}={}){
    const model=resolved[route?.profile];
    if(!apiKey||!model)throw fail('provider_not_configured',503,{provider:'gemini'});
    const contents=(Array.isArray(input)?input:[]).map(item=>({role:item?.role==='assistant'?'model':'user',parts:[{text:contentText(item?.content)}]}));
    const normalizedTools=normalizeTools(tools);
    const requestBody={systemInstruction:{parts:[{text:String(instructions||'')}]},contents,generationConfig:{maxOutputTokens:max_output_tokens}};
    if(normalizedTools.declarations.length)requestBody.tools=[{functionDeclarations:normalizedTools.declarations}];
    let response;
    try{response=await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'x-goog-api-key':apiKey,'content-type':'application/json'},body:JSON.stringify(requestBody)});}catch{throw fail('provider_unavailable',502,{provider:'gemini'});}
    if(!response.ok)throw errorForStatus(response.status);
    const data=await response.json().catch(()=>({}));
    const text=outputText(data),tool_calls=normalizeFunctionCalls(data,normalizedTools.metadata);
    if(!text&&!tool_calls.length)throw fail('internal_error',500,{provider:'gemini'});
    return {provider:'gemini',model,text,capabilities_used:[...(route?.capabilities||['generation'])],usage:data.usageMetadata||{},provenance:[],tool_calls};
  }
  return Object.freeze({descriptor,probe,execute});
}
