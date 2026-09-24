const PROFILES=Object.freeze(['fast','balanced','deep']);
function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function clean(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function errorForStatus(status){if(status===401||status===403)return fail('provider_auth_failed',503,{provider:'codex-sovereign'});if(status===404)return fail('provider_not_configured',503,{provider:'codex-sovereign'});if(status===429)return fail('provider_rate_limited',429,{provider:'codex-sovereign'});if(status>=500)return fail('provider_unavailable',502,{provider:'codex-sovereign'});return fail('provider_unavailable',502,{provider:'codex-sovereign'});}
export function createCodexSovereignAdapter({endpoint,token,model,fetchFn=fetch}={}){
  const base=clean(endpoint)?.replace(/\/+$/,'')||null;
  const configuredModel=clean(model);
  const configured=Boolean(base&&token&&configuredModel);
  const descriptor=()=>({id:'codex-sovereign',configured,verified:false,capabilities:['generation','reasoning'],profiles:[...PROFILES],api:'sovereign-runtime',model:configuredModel});
  async function probe(){
    if(!configured)return {configured:false,verified:false,provider:'codex-sovereign',model:configuredModel,error:'provider_not_configured'};
    let response;
    try{response=await fetchFn(`${base}/health`,{headers:{authorization:`Bearer ${token}`,'content-type':'application/json'}});}catch{return {configured:true,verified:false,provider:'codex-sovereign',model:configuredModel,error:'provider_unavailable'};}
    if(!response.ok){const e=errorForStatus(response.status);return {configured:true,verified:false,provider:'codex-sovereign',model:configuredModel,error:e.code};}
    const data=await response.json().catch(()=>({}));
    return {configured:true,verified:data?.ok!==false,provider:'codex-sovereign',model:data?.model||configuredModel,error:data?.ok===false?'provider_unavailable':null};
  }
  async function execute({route,instructions,input,max_output_tokens=3000}={}){
    if(!configured)throw fail('provider_not_configured',503,{provider:'codex-sovereign'});
    let response;
    try{response=await fetchFn(`${base}/execute`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({model:configuredModel,profile:route?.profile||'balanced',capabilities:route?.capabilities||['generation'],instructions:String(instructions||''),input:Array.isArray(input)?input:[],max_output_tokens})});}catch{throw fail('provider_unavailable',502,{provider:'codex-sovereign'});}
    if(!response.ok)throw errorForStatus(response.status);
    const data=await response.json().catch(()=>({}));const text=typeof data?.text==='string'?data.text.trim():'';
    if(!text)throw fail('internal_error',500,{provider:'codex-sovereign'});
    return {provider:'codex-sovereign',model:data.model||configuredModel,text,capabilities_used:[...(route?.capabilities||['generation'])],usage:data.usage||{},provenance:Array.isArray(data.provenance)?data.provenance:[],tool_calls:Array.isArray(data.tool_calls)?data.tool_calls:[]};
  }
  return Object.freeze({descriptor,probe,execute});
}
