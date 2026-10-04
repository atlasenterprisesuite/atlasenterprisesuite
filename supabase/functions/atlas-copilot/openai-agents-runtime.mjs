const RUNTIME_ID='openai-agents';
const PROVIDER_ID='openai';
const ALLOWED_ENVIRONMENTS=new Set(['none','openai_hosted','self_hosted']);
function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function clean(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function errorCodeForStatus(status){if(status===401||status===403)return'provider_auth_failed';if(status===429)return'provider_rate_limited';if(status>=500)return'provider_unavailable';if(status===404)return'provider_not_configured';return'provider_unavailable';}
function errorStatus(code){if(code==='provider_rate_limited')return 429;if(code==='provider_auth_failed'||code==='provider_not_configured')return 503;return 502;}
function normalizeArguments(value){if(value&&typeof value==='object'&&!Array.isArray(value))return structuredClone(value);if(typeof value==='string'){try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed;}catch{}return {input:value};}return{};}
function normalizeToolDefinitions(toolPolicy={}){
  const tools=Array.isArray(toolPolicy?.tools)?toolPolicy.tools:[];
  const byName=new Map();
  const providerTools=[];
  for(const raw of tools){
    const name=clean(raw?.name);if(!name||byName.has(name))continue;
    const normalized={
      name,
      description:String(raw?.description||''),
      parameters:raw?.parameters&&typeof raw.parameters==='object'?structuredClone(raw.parameters):{type:'object',properties:{},additionalProperties:false},
      risk_class:String(raw?.risk_class||'read-only'),
      required_permissions:Array.isArray(raw?.required_permissions)?[...new Set(raw.required_permissions.map(String))]:[],
      side_effect:String(raw?.side_effect||'none'),
      cost_class:String(raw?.cost_class||'none'),
    };
    byName.set(name,normalized);
    providerTools.push({type:'function',name,description:normalized.description,parameters:normalized.parameters});
  }
  return {byName,providerTools};
}
function latestUserInput(input=[]){
  const items=Array.isArray(input)?input:[];
  for(let i=items.length-1;i>=0;i-=1){if(items[i]?.role==='user'){const content=items[i]?.content;return typeof content==='string'?content:JSON.stringify(content??'');}}
  return '';
}
function toolCallsFromRequiredActions(actions=[],toolMap,sessionId){
  const calls=[];
  for(const action of Array.isArray(actions)?actions:[]){
    if(action?.type==='function_call'){
      const policy=toolMap.get(String(action.name||''));
      calls.push({
        provider:PROVIDER_ID,
        runtime:RUNTIME_ID,
        tool_name:String(action.name||''),
        arguments:normalizeArguments(action.arguments),
        risk_class:policy?.risk_class||'mutation',
        required_permissions:policy?.required_permissions||[],
        side_effect:policy?.side_effect||'external',
        cost_class:policy?.cost_class||'none',
        provider_session_id:sessionId,
        provider_turn_id:clean(action.turn_id),
        provider_call_id:clean(action.call_id),
      });
      continue;
    }
    if(action?.type==='computer_use_approval_request'){
      calls.push({
        provider:PROVIDER_ID,
        runtime:RUNTIME_ID,
        tool_name:'computer.use.approval',
        arguments:{request_id:clean(action.request_id),turn_id:clean(action.turn_id),request:action.request&&typeof action.request==='object'?structuredClone(action.request):{}},
        risk_class:'mutation',
        required_permissions:['computer.use'],
        side_effect:'external',
        cost_class:'none',
        provider_session_id:sessionId,
        provider_turn_id:clean(action.turn_id),
        provider_call_id:clean(action.request_id),
      });
    }
  }
  return calls;
}
function executionStateFor(status){if(status==='requires_action')return'requires_action';if(status==='failed')return'failed';return'incomplete';}
export function createOpenAIAgentsRuntime({apiKey,enabled=false,environment='openai_hosted',allowComputerUse=false,fetchFn=fetch}={}){
  const runtimeEnvironment=clean(environment)||'openai_hosted';
  const configured=Boolean(apiKey);
  const descriptor=()=>({id:RUNTIME_ID,provider:PROVIDER_ID,enabled:enabled===true,configured,environment:runtimeEnvironment,computer_use_enabled:allowComputerUse===true,canonical_memory:false});
  async function execute({context={},route={},trace_id=null,instructions='',input=[],tool_policy={}}={}){
    if(enabled!==true)throw fail('runtime_not_enabled',409,{runtime:RUNTIME_ID});
    if(!ALLOWED_ENVIRONMENTS.has(runtimeEnvironment))throw fail('invalid_runtime_environment',400,{runtime:RUNTIME_ID,environment:runtimeEnvironment});
    if(!apiKey)throw fail('runtime_not_configured',503,{runtime:RUNTIME_ID});
    if(route?.provider&&route.provider!==PROVIDER_ID)throw fail('runtime_provider_mismatch',409,{runtime:RUNTIME_ID,provider:route.provider});
    const model=clean(route?.model);
    if(!model||route?.model_verification_state!=='verified')throw fail('model_unavailable',409,{runtime:RUNTIME_ID,model:model||null});
    const {byName,providerTools}=normalizeToolDefinitions(tool_policy);
    const body={
      agent:{model,instructions:String(instructions||''),tools:providerTools},
      environment:{type:runtimeEnvironment},
      input:latestUserInput(input),
      metadata:{
        atlas_request_id:String(context?.request_id||''),
        atlas_session_id:String(context?.session_id||''),
        atlas_trace_id:String(trace_id||''),
      },
      stream:false,
    };
    let response;
    try{response=await fetchFn('https://api.openai.com/v1/agents/sessions',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json','OpenAI-Beta':'agents=v1'},body:JSON.stringify(body)});}catch{throw fail('provider_unavailable',502,{runtime:RUNTIME_ID,provider:PROVIDER_ID});}
    if(!response.ok){const code=errorCodeForStatus(response.status);throw fail(code,errorStatus(code),{runtime:RUNTIME_ID,provider:PROVIDER_ID});}
    const data=await response.json().catch(()=>({}));
    const providerSessionId=clean(data?.id);
    if(!providerSessionId)throw fail('internal_error',500,{runtime:RUNTIME_ID,provider:PROVIDER_ID});
    const status=clean(data?.status)||'in_progress';
    return {
      runtime:RUNTIME_ID,
      provider:PROVIDER_ID,
      model:data?.agent?.model||model,
      provider_session_id:providerSessionId,
      status,
      execution_state:executionStateFor(status),
      text:null,
      tool_calls:toolCallsFromRequiredActions(data?.required_actions,byName,providerSessionId),
      tools_executed:[],
      capabilities_used:[...(Array.isArray(route?.capabilities)?route.capabilities:['generation'])],
      usage:data?.usage||{},
      provenance:[],
    };
  }
  async function cleanup({provider_session_id}={}){
    const sessionId=clean(provider_session_id);
    if(!sessionId)return {attempted:false,deleted:false,reason:'provider_session_id_required'};
    if(!apiKey)return {attempted:false,deleted:false,reason:'runtime_not_configured'};
    let response;
    try{response=await fetchFn(`https://api.openai.com/v1/agents/sessions/${encodeURIComponent(sessionId)}`,{method:'DELETE',headers:{authorization:`Bearer ${apiKey}`,'OpenAI-Beta':'agents=v1'}});}catch{return {attempted:true,deleted:false,reason:'provider_unavailable'};}
    if(!response.ok)return {attempted:true,deleted:false,reason:errorCodeForStatus(response.status)};
    const data=await response.json().catch(()=>({}));
    return {attempted:true,deleted:data?.deleted===true,reason:data?.deleted===true?null:'provider_cleanup_unconfirmed'};
  }
  return Object.freeze({descriptor,execute,cleanup});
}
