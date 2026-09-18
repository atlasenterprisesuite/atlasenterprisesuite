import {createIntelligenceGateway,createIntelligenceRouter,normalizeIntelligenceError} from './intelligence-gateway.mjs';
import {resolveIntelligenceContext} from './atlas-intelligence-auth.mjs';
import {createIntelligenceStore} from './atlas-intelligence-store.mjs';
import {createOpenAIResponsesAdapter} from './openai-responses-adapter.mjs';
import {createGeminiAdapter} from './gemini-adapter.mjs';
import {createCodexSovereignAdapter} from './codex-sovereign-adapter.mjs';
import {createProviderRegistry} from './provider-registry.mjs';
import {createCouncilOrchestrator} from './council-orchestrator.mjs';
import {createToolGateway} from './tool-gateway.mjs';
import {renderAtlasCopilotPage} from './ui.mjs';

const U='https://ggmanzcgtlrvqfoccgsh.supabase.co';
const K='sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';
const LIVE='/functions/v1/atlas-live';
const SELF='/functions/v1/atlas-copilot';
const REPAIR='/functions/v1/atlas-repair-bridge';
const VERSION=5;
const PROVIDER_IDS=['openai','gemini','codex-sovereign'];
const DEFAULT_OPENAI_MODEL='gpt-6-astra';

function clean(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function profileModels(sharedName,fastName,balancedName,deepName,legacySharedName=null,defaultModel=null){
  const shared=clean(Deno.env.get(sharedName))||clean(legacySharedName?Deno.env.get(legacySharedName):null)||clean(defaultModel);
  return {
    fast:clean(Deno.env.get(fastName))||shared,
    balanced:clean(Deno.env.get(balancedName))||shared,
    deep:clean(Deno.env.get(deepName))||shared,
  };
}
function csvEnv(name){return String(Deno.env.get(name)||'').split(',').map(v=>v.trim()).filter(Boolean);}
function boolEnv(name,fallback=false){const raw=clean(Deno.env.get(name));if(raw===null)return fallback;return ['1','true','yes','on'].includes(raw.toLowerCase());}
function headers(extra={}){return {'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin',...extra};}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:headers({'content-type':'application/json; charset=utf-8'})});}
function safeError(error){const n=normalizeIntelligenceError(error);return json({ok:false,error:n.code,trace_id:error?.trace_id||n.trace_id||null},n.status);}
function authRequest(req,organization_id){if(!organization_id||req.headers.get('x-atlas-org-id'))return req;const h=new Headers(req.headers);h.set('x-atlas-org-id',String(organization_id));return new Request(req.url,{method:req.method,headers:h});}
function runtime(){
  const serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const openaiKey=Deno.env.get('OPENAI_API_KEY')||'';
  const geminiKey=Deno.env.get('GEMINI_API_KEY')||Deno.env.get('GOOGLE_AI_API_KEY')||'';
  const openaiModels=profileModels('ATLAS_OPENAI_MODEL','ATLAS_OPENAI_MODEL_FAST','ATLAS_OPENAI_MODEL_BALANCED','ATLAS_OPENAI_MODEL_DEEP','ATLAS_OPENAI_ASTRA_MODEL',DEFAULT_OPENAI_MODEL);
  const geminiModels=profileModels('ATLAS_GEMINI_MODEL','ATLAS_GEMINI_MODEL_FAST','ATLAS_GEMINI_MODEL_BALANCED','ATLAS_GEMINI_MODEL_DEEP');
  const codexEndpoint=clean(Deno.env.get('ATLAS_CODEX_SOVEREIGN_URL'));
  const codexToken=Deno.env.get('ATLAS_CODEX_SOVEREIGN_TOKEN')||'';
  const codexModel=clean(Deno.env.get('ATLAS_CODEX_SOVEREIGN_MODEL'));
  const costPolicy={
    allowed_providers:csvEnv('ATLAS_AI_ALLOWED_PROVIDERS').filter(id=>PROVIDER_IDS.includes(id)),
    zero_cost_providers:csvEnv('ATLAS_AI_ZERO_COST_PROVIDERS').filter(id=>PROVIDER_IDS.includes(id)),
    allow_paid_single:boolEnv('ATLAS_AI_ALLOW_PAID_SINGLE',true),
    allow_council:boolEnv('ATLAS_AI_ALLOW_COUNCIL',false),
  };
  return {serviceRoleKey,storageConfigured:Boolean(serviceRoleKey),openaiKey,geminiKey,openaiModels,geminiModels,codexEndpoint,codexToken,codexModel,costPolicy};
}
function registryFor(rt){
  return createProviderRegistry({providers:[
    createOpenAIResponsesAdapter({apiKey:rt.openaiKey,models:rt.openaiModels,fetchFn:fetch}),
    createGeminiAdapter({apiKey:rt.geminiKey,models:rt.geminiModels,fetchFn:fetch}),
    createCodexSovereignAdapter({endpoint:rt.codexEndpoint,token:rt.codexToken,model:rt.codexModel,fetchFn:fetch}),
  ]});
}
async function readinessFor(rt,profile='balanced'){
  const registry=registryFor(rt);
  const providers=await registry.readiness({profile});
  return {registry,providers};
}
function legacyProviderState(item){if(!item)return'not_configured';if(item.state==='verified')return'verified_for_request';if(item.state==='configuration-required')return'not_configured';if(item.state==='rate-limited')return'unavailable';return'configured_unverified';}
async function contextFor(req,organization_id){return resolveIntelligenceContext({request:authRequest(req,organization_id),supabaseUrl:U,publishableKey:K,fetchFn:fetch});}
function storeFor(serviceRoleKey){if(!serviceRoleKey)throw Object.assign(new Error('storage_not_configured'),{code:'storage_not_configured',status:503});return createIntelligenceStore({supabaseUrl:U,serviceRoleKey,fetchFn:fetch});}
async function parseJson(req){try{return await req.json()}catch{throw Object.assign(new Error('invalid_input'),{code:'invalid_input',status:400})}}
async function handleHistory(req){const rt=runtime(),resolved=await contextFor(req),store=storeFor(rt.serviceRoleKey),conversations=await store.listConversations({context:resolved.context});return json({ok:true,conversations});}
async function handleConversation(req,url){const rt=runtime(),resolved=await contextFor(req),id=url.searchParams.get('id');if(!id)return json({ok:false,error:'invalid_input'},400);const store=storeFor(rt.serviceRoleKey),conversation=await store.getConversation({context:resolved.context,id}),messages=await store.listMessages({context:resolved.context,conversation_id:id,limit:50});return json({ok:true,conversation,messages});}
async function handleStatus(req){
  const rt=runtime(),resolved=await contextFor(req),{providers}=await readinessFor(rt,'balanced');
  const openai=providers.find(p=>p.id==='openai');
  return json({ok:true,authenticated:true,provider:'openai',provider_state:legacyProviderState(openai),model:openai?.model||null,models:rt.openaiModels,providers,modes:['auto','openai','gemini','codex-sovereign','council'],api:'unified-provider-router',storage_state:rt.storageConfigured?'configured':'not_configured',organization:resolved.context.organization_id,role:resolved.context.roles[0]||null,capabilities:['generation','reasoning'],profiles:['fast','balanced','deep'],cost_policy:{allow_paid_single:rt.costPolicy.allow_paid_single,allow_council:rt.costPolicy.allow_council,allowed_providers:rt.costPolicy.allowed_providers,zero_cost_providers:rt.costPolicy.zero_cost_providers},repositoryMutation:'github-actions-oidc-queue'});
}
async function handleChat(req){
  if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
  const body=await parseJson(req),resolved=await contextFor(req,body?.organization_id),rt=runtime(),store=storeFor(rt.serviceRoleKey),message=String(body?.message||'').trim();
  if(!message)return json({ok:false,error:'invalid_input'},400);
  const legacy=String(body?.context||'').trim().slice(0,12000),intent=String(body?.intent||'balanced'),mode=String(body?.mode||'auto');
  const {registry,providers}=await readinessFor(rt,intent);
  const router=createIntelligenceRouter({providers,allowedProviders:rt.costPolicy.allowed_providers});
  const council=createCouncilOrchestrator({registry});
  const gateway=createIntelligenceGateway({router,registry,council,store,costPolicy:rt.costPolicy,toolGateway:createToolGateway()});
  const request=body?.context!==undefined&&body?.module===undefined
    ?{module:'workbench',intent:'balanced',mode,message,capabilities_requested:['generation'],client_metadata:{legacy_context_present:Boolean(legacy)},legacy_context:legacy}
    :{module:body?.module||'atlas',intent,mode,message,conversation_id:body?.conversation_id||null,capabilities_requested:Array.isArray(body?.capabilities_requested)?body.capabilities_requested:['generation'],client_metadata:body?.client_metadata&&typeof body.client_metadata==='object'?body.client_metadata:{},legacy_context:legacy};
  const result=await gateway.execute({context:resolved.context,request});
  return json({ok:true,...result,text:result.output,provider_state:'verified_for_request',provider_readiness:providers,execution:{repositoryMutation:false,repairQueue:'available',mode:'analysis'}});
}

Deno.serve(async req=>{
  const url=new URL(req.url),api=url.searchParams.get('api');
  try{
    if(api==='readiness'){
      const rt=runtime(),{providers}=await readinessFor(rt,'balanced'),openai=providers.find(p=>p.id==='openai');
      return json({ok:true,state:'ready',service:'atlas-copilot',version:VERSION,auth:'atlas-session-required-for-prompts',provider:'openai',provider_state:legacyProviderState(openai),model:openai?.model||null,models:rt.openaiModels,providers,modes:['auto','openai','gemini','codex-sovereign','council'],api:'unified-provider-router',reasoning_profiles:{fast:'low',balanced:'medium',deep:'high'},storage_state:rt.storageConfigured?'configured':'not_configured',cost_policy:{allow_paid_single:rt.costPolicy.allow_paid_single,allow_council:rt.costPolicy.allow_council},repositoryMutation:'github-actions-oidc-queue',repairBridge:REPAIR,checkedAt:new Date().toISOString()});
    }
    if(api==='status')return await handleStatus(req);
    if(api==='history')return await handleHistory(req);
    if(api==='conversation')return await handleConversation(req,url);
    if(api==='chat')return await handleChat(req);
    const html=renderAtlasCopilotPage({supabaseUrl:U,publishableKey:K,selfPath:SELF,repairPath:REPAIR,livePath:LIVE,version:VERSION});
    return new Response(html,{headers:headers({'content-type':'text/html; charset=utf-8','content-security-policy':`default-src 'self'; connect-src ${U}; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'`})});
  }catch(error){console.error('atlas_ia_request_failed',{code:error?.code||'internal_error'});return safeError(error);}
});
