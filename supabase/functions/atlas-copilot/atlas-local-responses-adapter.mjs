const PROFILES=Object.freeze(['fast','balanced','deep']);
const LOCAL_INPUT_CHAR_BUDGET=6000;
const LOCAL_MAX_OUTPUT_TOKENS=384;
const LOCAL_INSTRUCTION_CHAR_BUDGET=2600;
const LOCAL_SYSTEM_CORE=`You are ATLAS, one coherent cognitive system. Return one unified answer. Follow the user's authorized intent and current module context. Preserve authentication, tenant isolation, RBAC, least privilege, approval gates, auditability, privacy, and secret protection. Never expose credentials, secrets, private chain-of-thought, or unnecessary internal provider chatter. Do not fabricate data, tool results, provider state, tests, deployments, or production status. Distinguish verified, probable, unknown, conflicted, and blocked states. For requested actions, execute only within authorization, verify the result, and report the real state. Fail closed on unsafe or unauthorized mutations. Reuse existing ATLAS services, data, components, and sources of truth instead of creating parallel systems. Prefer concise RESULT, EVIDENCE, ACTION, STATUS, BLOCKERS, and NEXT ACTION when operational work is involved.`;
function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function clean(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function normalizeBase(value,{allowInsecure=false}={}){
  const raw=clean(value);
  if(!raw)return null;
  let url;
  try{url=new URL(raw);}catch{return null;}
  if(url.username||url.password)return null;
  if(url.protocol!=='https:'&&!(allowInsecure&&url.protocol==='http:'))return null;
  return url.toString().replace(/\/+$/,'');
}
function itemSize(item){try{return JSON.stringify(item??{}).length}catch{return String(item??'').length;}}
function compactInput(input,budget=LOCAL_INPUT_CHAR_BUDGET){
  const source=Array.isArray(input)?input:[];
  const selected=[];
  let used=0;
  for(let index=source.length-1;index>=0;index-=1){
    const item=source[index],size=Math.max(1,itemSize(item));
    if(selected.length&&used+size>budget)break;
    selected.push(item);
    used+=size;
    if(used>=budget)break;
  }
  return selected.reverse();
}
function compactInstructions(value){
  const raw=String(value||'').trim();
  if(raw.length<=LOCAL_INSTRUCTION_CHAR_BUDGET)return raw;
  const marker='CURRENT COGNITIVE CONTEXT';
  const index=raw.lastIndexOf(marker);
  const context=index>=0?raw.slice(index,index+800):'';
  return `${LOCAL_SYSTEM_CORE}${context?`\n\n${context}`:''}`.slice(0,LOCAL_INSTRUCTION_CHAR_BUDGET).trim();
}
function outputText(data){
  const parts=[];
  for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&part?.text)parts.push(String(part.text));
  if(parts.length)return parts.join('\n').trim();
  if(typeof data?.output_text==='string')return data.output_text.trim();
  return '';
}
function errorForStatus(status){
  if(status===401||status===403)return fail('provider_auth_failed',503,{provider:'atlas-local'});
  if(status===404)return fail('provider_not_configured',503,{provider:'atlas-local'});
  if(status===429)return fail('provider_rate_limited',429,{provider:'atlas-local'});
  if(status>=500)return fail('provider_unavailable',502,{provider:'atlas-local'});
  return fail('provider_unavailable',502,{provider:'atlas-local'});
}
export function createAtlasLocalResponsesAdapter({baseUrl,token='',accessClientId='',accessClientSecret='',models,allowUnauthenticated=false,allowInsecure=false,fetchFn=fetch,timeoutMs=120000,probeTimeoutMs=15000}={}){
  const base=normalizeBase(baseUrl,{allowInsecure});
  const resolved=Object.freeze({fast:clean(models?.fast),balanced:clean(models?.balanced),deep:clean(models?.deep)});
  const configured=Boolean(base)&&Object.values(resolved).some(Boolean)&&Boolean(token||allowUnauthenticated);
  const accessProtected=Boolean(clean(accessClientId)&&clean(accessClientSecret));
  const authHeaders=()=>({
    ...(token?{authorization:`Bearer ${token}`}:{}),
    ...(accessProtected?{'CF-Access-Client-Id':String(accessClientId),'CF-Access-Client-Secret':String(accessClientSecret)}:{}),
  });
  const descriptor=()=>({
    id:'atlas-local',
    configured,
    verified:false,
    capabilities:['generation','reasoning'],
    profiles:[...PROFILES],
    api:'responses-compatible',
    backend:'self-hosted',
    endpoint:'atlas-local-runtime',
    access_protected:accessProtected,
    models:{...resolved},
    feature_support:{
      local_inference:true,
      responses_api:true,
      streaming:false,
      tool_calling:false,
      computer_use:false,
      mid_turn_steering:false
    }
  });
  async function probe({profile='balanced'}={}){
    const model=resolved[profile];
    if(!configured||!model)return {configured:false,verified:false,provider:'atlas-local',model:model||null,error:'provider_not_configured'};
    let response;
    try{
      response=await fetchFn(`${base}/health`,{headers:{...authHeaders(),'content-type':'application/json'},signal:AbortSignal.timeout(Math.min(timeoutMs,probeTimeoutMs))});
    }catch{return {configured:true,verified:false,provider:'atlas-local',model,error:'provider_unavailable'};}
    if(response.ok)return {configured:true,verified:true,provider:'atlas-local',model,error:null};
    const error=errorForStatus(response.status);
    return {configured:true,verified:false,provider:'atlas-local',model,error:error.code};
  }
  async function execute({route,instructions,input,max_output_tokens=3000}={}){
    const profile=route?.profile||'balanced';
    const model=resolved[profile];
    if(!configured||!model)throw fail('provider_not_configured',503,{provider:'atlas-local'});
    const profileInstruction=profile==='deep'
      ? 'Use the deepest available local reasoning budget and verify important conclusions before answering.'
      : profile==='fast'
        ? 'Prefer a fast, concise local answer unless more reasoning is required for correctness.'
        : 'Use a balanced local reasoning budget.';
    const boundedMaxOutput=Math.max(64,Math.min(LOCAL_MAX_OUTPUT_TOKENS,Number(max_output_tokens)||LOCAL_MAX_OUTPUT_TOKENS));
    const localInstructions=compactInstructions(instructions);
    const body={model,instructions:`${localInstructions}\n\nATLAS LOCAL RUNTIME PROFILE: ${profileInstruction}`.trim(),input:compactInput(input),max_output_tokens:boundedMaxOutput,store:false};
    let response;
    try{
      response=await fetchFn(`${base}/v1/responses`,{method:'POST',headers:{...authHeaders(),'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)});
    }catch{throw fail('provider_unavailable',502,{provider:'atlas-local'});}
    if(!response.ok)throw errorForStatus(response.status);
    const data=await response.json().catch(()=>({}));
    const text=outputText(data);
    if(!text)throw fail('internal_error',500,{provider:'atlas-local'});
    return {provider:'atlas-local',model:data?.model||model,response_id:data?.id||null,text,capabilities_used:[...(route?.capabilities||['generation'])],usage:data?.usage||{},provenance:[],tool_calls:[]};
  }
  return Object.freeze({descriptor,probe,execute});
}
