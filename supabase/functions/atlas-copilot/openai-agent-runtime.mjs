const BASE='https://api.openai.com/v1/agents/sessions';
function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function clean(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function errorForStatus(status){if(status===401||status===403)return fail('provider_auth_failed',503,{provider:'openai'});if(status===404)return fail('provider_not_configured',503,{provider:'openai'});if(status===409)return fail('provider_conflict',409,{provider:'openai'});if(status===429)return fail('provider_rate_limited',429,{provider:'openai'});if(status>=500)return fail('provider_unavailable',502,{provider:'openai'});return fail('provider_unavailable',502,{provider:'openai'});}
function headers(apiKey){return {authorization:`Bearer ${apiKey}`,'content-type':'application/json','OpenAI-Beta':'agents=v1'};}
function sessionId(value){const id=clean(value);if(!id)throw fail('invalid_input',400,{field:'session_id'});return encodeURIComponent(id);}
async function decode(response){const data=await response.json().catch(()=>null);if(!response.ok)throw errorForStatus(response.status);if(data===null)throw fail('provider_unavailable',502,{provider:'openai'});return data;}

export function createOpenAIAgentRuntime({apiKey,model='gpt-6.1-sol',fetchFn=fetch}={}){
  const resolvedModel=clean(model);
  const configured=Boolean(apiKey&&resolvedModel);
  const descriptor=()=>({id:'openai-computer-use',configured,verified:false,provider:'openai',model:resolvedModel,api:'agents',capabilities:['computer_use']});
  function requireConfigured(){if(!configured)throw fail('provider_not_configured',503,{provider:'openai'});}
  async function request(url,init={}){requireConfigured();let response;try{response=await fetchFn(url,{...init,headers:{...headers(apiKey),...(init.headers||{})}});}catch{throw fail('provider_unavailable',502,{provider:'openai'});}return decode(response);}
  async function createSession({instructions='',includeScreenshots=false}={}){
    return request(BASE,{method:'POST',body:JSON.stringify({agent:{model:resolvedModel,instructions:String(instructions||''),tools:[{type:'computer_use',include_screenshots:Boolean(includeScreenshots)}]}})});
  }
  async function sendEvents({sessionId:rawSessionId,events}={}){
    if(!Array.isArray(events)||events.length===0)throw fail('invalid_input',400,{field:'events'});
    return request(`${BASE}/${sessionId(rawSessionId)}/events`,{method:'POST',body:JSON.stringify({events})});
  }
  async function getSession({sessionId:rawSessionId}={}){return request(`${BASE}/${sessionId(rawSessionId)}`);}
  async function listItems({sessionId:rawSessionId}={}){return request(`${BASE}/${sessionId(rawSessionId)}/items`);}
  async function deleteSession({sessionId:rawSessionId}={}){return request(`${BASE}/${sessionId(rawSessionId)}`,{method:'DELETE'});}
  return Object.freeze({descriptor,createSession,sendEvents,getSession,listItems,deleteSession});
}
