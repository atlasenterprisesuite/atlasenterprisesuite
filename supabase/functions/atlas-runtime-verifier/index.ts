import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyAtlasCopilotShell } from '../_shared/runtime-verifier-shell.ts';

const SUPABASE_URL='https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';
const COPILOT=`${SUPABASE_URL}/functions/v1/atlas-copilot`;
const SERVICE_ROLE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const E2E_EMAIL='atlas-intelligence-e2e@atlas.invalid';
const E2E_ORG='ATLAS Intelligence E2E';
const VERSION=3;
const TERMINAL=new Set(['passed','failed','blocked']);

type Check={ok:boolean,status:number|null,duration_ms:number,detail?:Record<string,unknown>};
type Checks=Record<string,Check>;

function headers(extra:Record<string,string>={}){return {'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...extra};}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:headers({'content-type':'application/json; charset=utf-8'})});}
function fail(code:string,status=500,detail=''){return Object.assign(new Error(code),{code,status,detail});}
function safeDetail(value:unknown){
  return String(value??'').slice(0,1000)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,'Bearer [REDACTED]')
    .replace(/(?:sk-|sb_secret_)[A-Za-z0-9_-]+/gi,'[REDACTED]')
    .replace(/(password|api[_-]?key|token)\s*[:=]\s*[^,;\s]+/gi,'$1=[REDACTED]');
}
function randomPassword(){const b=new Uint8Array(36);crypto.getRandomValues(b);return [...b].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function bodyJson(r:Response){const t=await r.text();try{return JSON.parse(t)}catch{return {raw:t.slice(0,500)}}}
async function request(url:string,{method='GET',headers:hs={},json:payload}:{method?:string,headers?:Record<string,string>,json?:unknown}={}){
  const h=new Headers({accept:'application/json',...hs}); let body:BodyInit|undefined;
  if(payload!==undefined){h.set('content-type','application/json');body=JSON.stringify(payload)}
  const r=await fetch(url,{method,headers:h,body,redirect:'manual',cache:'no-store'});
  return {r,payload:await bodyJson(r)};
}
function classify(error:any){
  const code=String(error?.code||'verifier_internal_error');
  if(code==='provider_not_configured')return {status:'blocked',code};
  if(code==='provider_rate_limited'||code==='provider_unavailable')return {status:'blocked',code};
  if(['authentication_failed','permission_denied','storage_unavailable','persistence_failed','continuity_failed','tenant_boundary_failed','target_unavailable','zero_cost_policy_violation'].includes(code))return {status:'failed',code};
  return {status:'failed',code:'verifier_internal_error'};
}

if(!SERVICE_ROLE) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
const admin=createClient(SUPABASE_URL,SERVICE_ROLE,{auth:{autoRefreshToken:false,persistSession:false}});

async function rpc(name:string,args:Record<string,unknown>={}){
  const {data,error}=await admin.rpc(name,args); if(error)throw fail('storage_unavailable',502,error.message); return data;
}
async function check(checks:Checks,name:string,fn:()=>Promise<{status?:number,detail?:Record<string,unknown>}|void>){
  const started=Date.now();
  try{const out=await fn()||{};checks[name]={ok:true,status:out.status??null,duration_ms:Date.now()-started,...(out.detail?{detail:out.detail}:{})};return out;}
  catch(error:any){checks[name]={ok:false,status:Number(error?.status)||null,duration_ms:Date.now()-started,detail:{error:String(error?.code||'check_failed')}};throw error;}
}
async function authorize(req:Request){
  const runtimeToken=(req.headers.get('x-atlas-runtime-verifier-token')||'').trim();
  if(!runtimeToken)throw fail('authentication_failed',401);
  const valid=await rpc('atlas_verify_runtime_invocation',{p_token:runtimeToken});
  if(valid!==true)throw fail('permission_denied',403);
}
async function begin(traceId:string){
  const id=await rpc('atlas_runtime_verification_begin',{p_verification_type:'intelligence-production',p_target_service:'atlas-copilot',p_environment:'production',p_trace_id:traceId});
  if(!id)throw fail('storage_unavailable',502,'verification begin returned no id');
  return String(id);
}
async function complete(runId:string,status:string,patch:Record<string,unknown>){
  if(!TERMINAL.has(status))throw fail('verifier_internal_error',500,'invalid terminal status');
  return rpc('atlas_runtime_verification_complete',{p_run_id:runId,p_status:status,p_patch:patch});
}

async function prepareIdentity(){
  const listed=await admin.auth.admin.listUsers({page:1,perPage:1000});
  if(listed.error)throw fail('authentication_failed',502,listed.error.message);
  const password=randomPassword();
  let user=listed.data.users.find(u=>String(u.email||'').toLowerCase()===E2E_EMAIL);
  if(user){
    const updated=await admin.auth.admin.updateUserById(user.id,{password,email_confirm:true,user_metadata:{full_name:'ATLAS Intelligence E2E',purpose:'non-destructive-production-e2e'}});
    if(updated.error||!updated.data.user)throw fail('authentication_failed',502,updated.error?.message||'missing user');
    user=updated.data.user;
  } else {
    const created=await admin.auth.admin.createUser({email:E2E_EMAIL,password,email_confirm:true,user_metadata:{full_name:'ATLAS Intelligence E2E',purpose:'non-destructive-production-e2e'}});
    if(created.error||!created.data.user)throw fail('authentication_failed',502,created.error?.message||'missing user');
    user=created.data.user;
  }
  const profile=await admin.from('profiles').upsert({id:user.id,full_name:'ATLAS Intelligence E2E'},{onConflict:'id'}); if(profile.error)throw fail('storage_unavailable',502,profile.error.message);
  const lookup=await admin.from('organizations').select('id').eq('name',E2E_ORG).limit(1); if(lookup.error)throw fail('storage_unavailable',502,lookup.error.message);
  let orgId=lookup.data?.[0]?.id as string|undefined;
  if(!orgId){
    const created=await admin.from('organizations').insert({name:E2E_ORG,legal_name:'ATLAS Intelligence E2E LLC',industry:'Quality Assurance / AI Verification',active:true,created_by:user.id}).select('id').single();
    if(created.error||!created.data?.id)throw fail('storage_unavailable',502,created.error?.message||'org create failed'); orgId=created.data.id;
  } else {
    const updated=await admin.from('organizations').update({active:true,legal_name:'ATLAS Intelligence E2E LLC',industry:'Quality Assurance / AI Verification'}).eq('id',orgId); if(updated.error)throw fail('storage_unavailable',502,updated.error.message);
  }
  const member=await admin.from('organization_members').upsert({org_id:orgId,user_id:user.id,role:'owner',status:'active'},{onConflict:'org_id,user_id'}); if(member.error)throw fail('storage_unavailable',502,member.error.message);
  const settings=await admin.from('organization_settings').upsert({org_id:orgId,settings:{e2e:true,non_destructive:true,purpose:'ATLAS Intelligence production verification'}},{onConflict:'org_id'}); if(settings.error)throw fail('storage_unavailable',502,settings.error.message);
  return {userId:user.id,orgId,password};
}

async function runVerification(){
  const traceId=crypto.randomUUID(); const checks:Checks={}; const runId=await begin(traceId); let providerState:string|null=null,storageState:string|null=null,orgId:string|null=null,conversationId:string|null=null,targetVersion:string|null=null,actualProvider:string|null=null,actualModel:string|null=null,automaticApiCostUsd:number|null=null;
  try{
    await check(checks,'01_shell',async()=>{
      const r=await fetch(COPILOT,{cache:'no-store'});
      const text=await r.text();
      const shell=verifyAtlasCopilotShell({status:r.status,contentType:r.headers.get('content-type'),body:text});
      if(!shell.ok)throw fail('target_unavailable',502,shell.reason);
      return {status:r.status,detail:{contract:'html_shell'}};
    });
    let readiness:any;
    await check(checks,'02_readiness',async()=>{const x=await request(`${COPILOT}?api=readiness`);if(x.r.status!==200||x.payload?.service!=='atlas-copilot'||x.payload?.storage_state!=='configured')throw fail('storage_unavailable',502);readiness=x.payload;providerState=String(x.payload.provider_state||'unknown');storageState=String(x.payload.storage_state||'unknown');targetVersion=String(x.payload.version||'');return {status:x.r.status,detail:{service:x.payload.service,version:x.payload.version,provider_state:providerState,storage_state:storageState}};});
    await check(checks,'03_anonymous_status_rejected',async()=>{const x=await request(`${COPILOT}?api=status`);if(x.r.status!==401||x.payload?.error!=='authentication_required')throw fail('permission_denied',500);return {status:x.r.status};});
    await check(checks,'04_anonymous_chat_rejected',async()=>{const x=await request(`${COPILOT}?api=chat`,{method:'POST',json:{message:'native-boundary-check'}});if(x.r.status!==401||x.payload?.error!=='authentication_required')throw fail('permission_denied',500);return {status:x.r.status};});
    let identity:any;
    await check(checks,'05_e2e_identity_prepared',async()=>{identity=await prepareIdentity();orgId=identity.orgId;return {status:200,detail:{organization_id:orgId}};});
    let accessToken='';
    await check(checks,'06_password_authentication',async()=>{const x=await request(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:PUBLISHABLE_KEY},json:{email:E2E_EMAIL,password:identity.password}});if(x.r.status!==200||String(x.payload?.access_token||'').length<=40)throw fail('authentication_failed',x.r.status||401);accessToken=String(x.payload.access_token);return {status:x.r.status};});
    const authHeaders={apikey:PUBLISHABLE_KEY,authorization:`Bearer ${accessToken}`,'x-atlas-org-id':String(orgId),'x-atlas-session-id':`native-verify-${traceId}`};
    let statusPayload:any;
    await check(checks,'07_authenticated_status_org',async()=>{const x=await request(`${COPILOT}?api=status`,{headers:authHeaders});if(x.r.status!==200||x.payload?.organization!==orgId)throw fail('authentication_failed',x.r.status||403);statusPayload=x.payload;providerState=String(x.payload.provider_state||providerState||'unknown');storageState=String(x.payload.storage_state||storageState||'unknown');return {status:x.r.status,detail:{role:x.payload.role,provider_state:providerState,storage_state:storageState}};});
    await check(checks,'08_permission_intelligence_use',async()=>{if(statusPayload?.ok!==true)throw fail('permission_denied',403);return {status:200,detail:{effective:true}};});
    await check(checks,'09_provider_verified',async()=>{if(providerState==='not_configured')throw fail('provider_not_configured',503);if(providerState!=='verified_for_request')throw fail(providerState==='unavailable'?'provider_unavailable':'provider_unavailable',502);return {status:200,detail:{provider_state:providerState}};});
    const marker=`ATLAS-NATIVE-VERIFY-${traceId}`; let first:any;
    await check(checks,'10_first_chat',async()=>{const x=await request(`${COPILOT}?api=chat`,{method:'POST',headers:authHeaders,json:{organization_id:orgId,module:'workbench',intent:'fast',capabilities_requested:['generation','reasoning'],message:`${marker}. Authorized non-destructive production verification. Reply briefly and include ${marker}.`}});if(x.r.status!==200||x.payload?.ok!==true||x.payload?.status!=='completed'||!String(x.payload?.output||x.payload?.text||'').trim())throw fail(x.payload?.error||'target_unavailable',x.r.status||502);first=x.payload;conversationId=String(first.conversation_id||'');actualProvider=String(first.provider||'');actualModel=String(first.model||'');automaticApiCostUsd=Number(first.automatic_api_cost_usd);return {status:x.r.status,detail:{provider:actualProvider,model:actualModel,automatic_api_cost_usd:Number.isFinite(automaticApiCostUsd)?automaticApiCostUsd:null}};});
    await check(checks,'11_conversation_created',async()=>{if(!conversationId)throw fail('persistence_failed',500);return {status:200,detail:{conversation_id:conversationId}};});
    let second:any; await check(checks,'12_second_chat_continuity',async()=>{const x=await request(`${COPILOT}?api=chat`,{method:'POST',headers:authHeaders,json:{organization_id:orgId,module:'workbench',intent:'balanced',conversation_id:conversationId,capabilities_requested:['generation','reasoning'],message:`Continue ${marker} in the same conversation and confirm continuity briefly.`}});if(x.r.status!==200||x.payload?.status!=='completed'||x.payload?.conversation_id!==conversationId||!String(x.payload?.output||x.payload?.text||'').trim())throw fail('continuity_failed',x.r.status||500);second=x.payload;return {status:x.r.status,detail:{provider:String(second.provider||''),model:String(second.model||''),automatic_api_cost_usd:Number.isFinite(Number(second.automatic_api_cost_usd))?Number(second.automatic_api_cost_usd):null}};});
    await check(checks,'12b_zero_cost_local_execution',async()=>{const secondProvider=String(second?.provider||'');const firstCost=Number(first?.automatic_api_cost_usd);const secondCost=Number(second?.automatic_api_cost_usd);if(actualProvider!=='atlas-local'||secondProvider!=='atlas-local'||!Number.isFinite(firstCost)||!Number.isFinite(secondCost)||firstCost!==0||secondCost!==0)throw fail('zero_cost_policy_violation',500,`first_provider=${actualProvider||'none'} second_provider=${secondProvider||'none'} first_cost=${String(first?.automatic_api_cost_usd)} second_cost=${String(second?.automatic_api_cost_usd)}`);automaticApiCostUsd=0;return {status:200,detail:{provider:'atlas-local',model:actualModel,first_turn_cost_usd:firstCost,second_turn_cost_usd:secondCost,automatic_api_cost_usd:0}};});
    await check(checks,'13_history_persisted',async()=>{const x=await request(`${COPILOT}?api=history`,{headers:authHeaders});if(x.r.status!==200||!(x.payload?.conversations||[]).some((c:any)=>c.id===conversationId))throw fail('persistence_failed',x.r.status||500);return {status:x.r.status};});
    await check(checks,'14_conversation_messages_persisted',async()=>{const x=await request(`${COPILOT}?api=conversation&id=${encodeURIComponent(String(conversationId))}`,{headers:authHeaders});const ms=x.payload?.messages||[];if(x.r.status!==200||ms.length<4||!ms.some((m:any)=>String(m?.content?.text||'').includes(marker)))throw fail('persistence_failed',x.r.status||500);return {status:x.r.status,detail:{message_count:ms.length}};});
    const foreignOrg=crypto.randomUUID();
    await check(checks,'15_cross_tenant_denied',async()=>{const x=await request(`${COPILOT}?api=status`,{headers:{...authHeaders,'x-atlas-org-id':foreignOrg}});if(x.r.status!==403||x.payload?.error!=='organization_membership_required')throw fail('tenant_boundary_failed',x.r.status||500);return {status:x.r.status,detail:{error:'organization_membership_required'}};});
    await check(checks,'16_completion_gate',async()=>{if(Object.values(checks).some(c=>!c.ok))throw fail('verifier_internal_error',500);return {status:200,detail:{all_required_checks:true}};});
    await complete(runId,'passed',{target_version:targetVersion,provider:actualProvider,provider_state:providerState,storage_state:storageState,organization_id:orgId,conversation_id:conversationId,checks,metadata:{verifier_version:VERSION,source:'supabase-native',model:actualModel,automatic_api_cost_usd:automaticApiCostUsd}});
    return {ok:true,run_id:runId,status:'passed',trace_id:traceId,provider:actualProvider,model:actualModel,automatic_api_cost_usd:automaticApiCostUsd,provider_state:providerState,storage_state:storageState,conversation_id:conversationId,checks};
  }catch(error:any){
    const c=classify(error);
    await complete(runId,c.status,{target_version:targetVersion,provider:actualProvider,provider_state:providerState,storage_state:storageState,organization_id:orgId,conversation_id:conversationId,checks,metadata:{verifier_version:VERSION,source:'supabase-native',model:actualModel,automatic_api_cost_usd:automaticApiCostUsd},error_code:c.code,error_detail:safeDetail(error?.detail||error?.message||c.code)}).catch(()=>{});
    return {ok:false,run_id:runId,status:c.status,trace_id:traceId,provider:actualProvider,model:actualModel,automatic_api_cost_usd:automaticApiCostUsd,provider_state:providerState,storage_state:storageState,conversation_id:conversationId,checks,error_code:c.code};
  }
}

Deno.serve(async(req:Request)=>{
  const u=new URL(req.url),api=u.searchParams.get('api');
  if(req.method==='GET'&&api==='readiness')return json({ok:true,service:'atlas-runtime-verifier',version:VERSION,verification_target:'atlas-copilot',auth:'vault-backed-custom-token',github_required:false});
  if(req.method==='POST'&&api==='verify'){
    try{await authorize(req);const result=await runVerification();return json(result,result.ok?200:result.status==='blocked'?503:500);}
    catch(error:any){return json({ok:false,error:String(error?.code||'verifier_internal_error')},Number(error?.status)||500);}
  }
  return json({ok:false,error:'not_found'},404);
});
