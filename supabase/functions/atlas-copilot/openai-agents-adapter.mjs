const PROFILES=Object.freeze(['fast','balanced','deep']);
const API_ROOT='https://api.openai.com/v1/agents/sessions';
function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function cleanModel(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function errorForStatus(status){if(status===400)return fail('invalid_input',400,{provider:'openai'});if(status===401||status===403)return fail('provider_auth_failed',503,{provider:'openai'});if(status===404)return fail('provider_not_configured',503,{provider:'openai'});if(status===409)return fail('provider_conflict',409,{provider:'openai'});if(status===429)return fail('provider_rate_limited',429,{provider:'openai'});if(status>=500)return fail('provider_unavailable',502,{provider:'openai'});return fail('provider_unavailable',502,{provider:'openai'});}
async function providerJson(response){try{return await response.json();}catch{return {};}}
function sessionId(value){const id=typeof value==='string'&&value.trim()?value.trim():null;if(!id)throw fail('invalid_input',400,{provider:'openai'});return id;}
function requestId(value){const id=typeof value==='string'&&value.trim()?value.trim():null;if(!id)throw fail('invalid_input',400,{provider:'openai'});return id;}
function normalizeHost(value){const raw=typeof value==='string'?value.trim():'';if(!raw)return null;try{const u=raw.includes('://')?new URL(raw):new URL(`https://${raw}`);if(u.username||u.password||u.port)return null;const host=u.hostname.toLowerCase();if(!host||host.includes('*'))return null;return host;}catch{return null;}}
function normalizeAllowlist(values){const hosts=[...new Set((Array.isArray(values)?values:[]).map(normalizeHost).filter(Boolean))];if(hosts.length>100)throw fail('network_allowlist_too_large',400,{provider:'openai'});return hosts;}
function headers(apiKey,extra={}){return {authorization:`Bearer ${apiKey}`,'content-type':'application/json','OpenAI-Beta':'agents=v1',...extra};}
async function call(fetchFn,url,init){let response;try{response=await fetchFn(url,init);}catch{throw fail('provider_unavailable',502,{provider:'openai'});}if(!response.ok)throw errorForStatus(response.status);return providerJson(response);}
export function createOpenAIAgentsAdapter({apiKey,models,fetchFn=fetch}={}){
  const resolved=Object.freeze({fast:cleanModel(models?.fast),balanced:cleanModel(models?.balanced),deep:cleanModel(models?.deep)});
  const configured=Boolean(apiKey)&&Object.values(resolved).some(Boolean);
  const descriptor=()=>({id:'openai',configured,verified:false,api:'agents',models:{...resolved},profiles:[...PROFILES],feature_support:{background:true,multi_agent:true,computer_use:true,function_calling:true,remote_mcp:true,programmatic_tool_calling:true,dynamic_workflows:false}});
  function requireConfigured(profile='balanced'){const model=resolved[profile];if(!apiKey||!model)throw fail('provider_not_configured',503,{provider:'openai'});return model;}
  async function createSession({profile='balanced',instructions='',computer_use=false,multi_agent=false,max_concurrent_subagents=3,network_allowlist=[]}={}){
    const model=requireConfigured(profile);
    const agent={model,instructions:String(instructions||'')};
    if(computer_use)agent.tools=[{type:'computer_use'}];
    if(multi_agent){const max=Number(max_concurrent_subagents);if(!Number.isInteger(max)||max<1)throw fail('invalid_input',400,{provider:'openai'});agent.multi_agent={enabled:true,max_concurrent_subagents:max};}
    let environment={type:'none'};
    if(computer_use){const allowed=normalizeAllowlist(network_allowlist);if(!allowed.length)throw fail('network_allowlist_required',400,{provider:'openai'});environment={type:'openai_hosted',desktop:{enabled:true},network:{access:'restricted',allowed_domains:allowed}};}
    const data=await call(fetchFn,API_ROOT,{method:'POST',headers:headers(apiKey),body:JSON.stringify({agent,environment})});
    const id=typeof data?.id==='string'&&data.id.trim()?data.id.trim():null;if(!id)throw fail('internal_error',500,{provider:'openai'});
    return {session_id:id,status:data?.status||'provisioning',model:data?.agent?.model||model,environment_id:data?.environment?.id||null};
  }
  async function sendInput({session_id,text,idempotency_key}={}){
    requireConfigured('balanced');const id=sessionId(session_id),message=typeof text==='string'&&text.trim()?text.trim():null;if(!message)throw fail('invalid_input',400,{provider:'openai'});
    const key=typeof idempotency_key==='string'&&idempotency_key.trim()?idempotency_key.trim():null;
    const extra=key?{'Idempotency-Key':key}:{};
    return call(fetchFn,`${API_ROOT}/${encodeURIComponent(id)}/events`,{method:'POST',headers:headers(apiKey,extra),body:JSON.stringify({events:[{type:'agent.session.input.message',input:[{role:'user',content:[{type:'input_text',text:message}]}]}]})});
  }
  async function retrieveSession({session_id}={}){requireConfigured('balanced');const id=sessionId(session_id);return call(fetchFn,`${API_ROOT}/${encodeURIComponent(id)}`,{method:'GET',headers:headers(apiKey)});}
  async function submitApproval({session_id,request_id,response}={}){
    requireConfigured('balanced');const id=sessionId(session_id),rid=requestId(request_id);if(!response||typeof response!=='object')throw fail('invalid_input',400,{provider:'openai'});
    return call(fetchFn,`${API_ROOT}/${encodeURIComponent(id)}/events`,{method:'POST',headers:headers(apiKey),body:JSON.stringify({events:[{type:'agent.session.input.computer_use_approval_request_result',request_id:rid,response}]})});
  }
  async function deleteSession({session_id}={}){requireConfigured('balanced');const id=sessionId(session_id);return call(fetchFn,`${API_ROOT}/${encodeURIComponent(id)}`,{method:'DELETE',headers:headers(apiKey)});}
  return Object.freeze({descriptor,createSession,sendInput,retrieveSession,submitApproval,deleteSession});
}
