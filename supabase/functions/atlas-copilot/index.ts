import {createIntelligenceGateway,createIntelligenceRouter,normalizeIntelligenceError} from './intelligence-gateway.mjs';
import {resolveIntelligenceContext} from './atlas-intelligence-auth.mjs';
import {createIntelligenceStore} from './atlas-intelligence-store.mjs';
import {createOpenAIResponsesAdapter} from './openai-responses-adapter.mjs';
import {detectOracleIntent} from './oracle-intent.mjs';
import {renderAtlasCopilotPage} from './ui.mjs';

const U='https://ggmanzcgtlrvqfoccgsh.supabase.co';
const K='sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';
const LIVE='/functions/v1/atlas-live';
const SELF='/functions/v1/atlas-copilot';
const REPAIR='/functions/v1/atlas-repair-bridge';
const ORACLE='/functions/v1/atlas-oracle';
const VERSION=5;
const ASTRA_MODEL=Deno.env.get('ATLAS_OPENAI_ASTRA_MODEL')||'gpt-6-astra';
const MODELS={fast:ASTRA_MODEL,balanced:ASTRA_MODEL,deep:ASTRA_MODEL};
function headers(extra={}){return {'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin',...extra};}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:headers({'content-type':'application/json; charset=utf-8'})});}
function safeError(error){const n=normalizeIntelligenceError(error);return json({ok:false,error:n.code,trace_id:error?.trace_id||n.trace_id||null},n.status);}
function authRequest(req,organization_id){if(!organization_id||req.headers.get('x-atlas-org-id'))return req;const h=new Headers(req.headers);h.set('x-atlas-org-id',String(organization_id));return new Request(req.url,{method:req.method,headers:h});}
function runtime(){const serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',apiKey=Deno.env.get('OPENAI_API_KEY')||'';return {serviceRoleKey,apiKey,storageConfigured:Boolean(serviceRoleKey),providerConfigured:Boolean(apiKey)};}
async function contextFor(req,organization_id){return resolveIntelligenceContext({request:authRequest(req,organization_id),supabaseUrl:U,publishableKey:K,fetchFn:fetch});}
function storeFor(serviceRoleKey){if(!serviceRoleKey)throw Object.assign(new Error('storage_not_configured'),{code:'storage_not_configured',status:503});return createIntelligenceStore({supabaseUrl:U,serviceRoleKey,fetchFn:fetch});}
async function providerState(apiKey,profile='balanced'){if(!apiKey)return {state:'not_configured',probe:{configured:false,verified:false,provider:'openai',model:MODELS[profile],error:'provider_not_configured'}};const adapter=createOpenAIResponsesAdapter({apiKey,models:MODELS,fetchFn:fetch});const probe=await adapter.probe({profile});return {state:probe.verified?'verified_for_request':probe.error==='provider_unavailable'||probe.error==='provider_rate_limited'?'unavailable':'configured_unverified',probe,adapter};}
async function parseJson(req){try{return await req.json()}catch{throw Object.assign(new Error('invalid_input'),{code:'invalid_input',status:400})}}
async function handleHistory(req){const rt=runtime(),resolved=await contextFor(req),store=storeFor(rt.serviceRoleKey),conversations=await store.listConversations({context:resolved.context});return json({ok:true,conversations});}
async function handleConversation(req,url){const rt=runtime(),resolved=await contextFor(req),id=url.searchParams.get('id');if(!id)return json({ok:false,error:'invalid_input'},400);const store=storeFor(rt.serviceRoleKey),conversation=await store.getConversation({context:resolved.context,id}),messages=await store.listMessages({context:resolved.context,conversation_id:id,limit:50});return json({ok:true,conversation,messages});}
async function handleStatus(req){const rt=runtime(),resolved=await contextFor(req),state=await providerState(rt.apiKey,'balanced');return json({ok:true,authenticated:true,provider:'openai',provider_state:state.state,model:state.probe.model,models:MODELS,api:'responses',storage_state:rt.storageConfigured?'configured':'not_configured',organization:resolved.context.organization_id,role:resolved.context.roles[0]||null,capabilities:['generation','reasoning','private-oracle'],profiles:['fast','balanced','deep'],repositoryMutation:'github-actions-oidc-queue'});}
async function handleOracle(req,body,message,oracleIntent){
  const resolved=await contextFor(req,body?.organization_id);
  const authorization=req.headers.get('authorization')||'';
  const response=await fetch(`${U}${ORACLE}?api=create`,{
    method:'POST',
    headers:{apikey:K,authorization,'content-type':'application/json','x-atlas-org-id':String(resolved.context.organization_id)},
    body:JSON.stringify({reading_type:oracleIntent.readingType,focus:message,organization_id:resolved.context.organization_id})
  });
  let result={};
  try{result=await response.json();}catch{result={ok:false,error:`oracle_request_failed_${response.status}`};}
  if(!response.ok)return json({ok:false,error:result?.error||'oracle_request_failed',oracle:true},response.status);
  const lines=Array.isArray(result?.interpretation)?result.interpretation.map(item=>`${item?.position?.label||'Reflection'} — ${item?.card?.title||'Card'}: ${item?.reflection||''}`):[];
  return json({ok:true,oracle:true,reading:result?.reading||null,cards:result?.selected_cards||result?.cards||[],interpretation:result?.interpretation||[],disclaimer:result?.disclaimer||null,text:lines.join('\n\n'),provider_state:'not_used',execution:{repositoryMutation:false,mode:'private-oracle'}});
}
async function handleChat(req){if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);const body=await parseJson(req),message=String(body?.message||'').trim();if(!message)return json({ok:false,error:'invalid_input'},400);const oracleIntent=detectOracleIntent(message);if(oracleIntent)return await handleOracle(req,body,message,oracleIntent);const resolved=await contextFor(req,body?.organization_id),rt=runtime(),store=storeFor(rt.serviceRoleKey),legacy=String(body?.context||'').trim().slice(0,12000),intent=String(body?.intent||'balanced');const p=await providerState(rt.apiKey,intent);if(!p.adapter)return json({ok:false,error:p.probe.error||'provider_not_configured',provider_state:p.state},p.state==='not_configured'?503:502);if(!p.probe.verified)return json({ok:false,error:p.probe.error||'provider_unavailable',provider_state:p.state},p.probe.error==='provider_rate_limited'?429:502);const router=createIntelligenceRouter({providers:[{id:'openai',configured:true,verified:true,capabilities:['generation','reasoning'],profiles:['fast','balanced','deep']}]});const gateway=createIntelligenceGateway({router,provider:p.adapter,store});const request=body?.context!==undefined&&body?.module===undefined?{module:'workbench',intent:'balanced',message,capabilities_requested:['generation'],client_metadata:{legacy_context_present:Boolean(legacy)},legacy_context:legacy}:{module:body?.module||'atlas',intent,message,conversation_id:body?.conversation_id||null,capabilities_requested:Array.isArray(body?.capabilities_requested)?body.capabilities_requested:['generation'],client_metadata:body?.client_metadata&&typeof body.client_metadata==='object'?body.client_metadata:{},legacy_context:legacy};const result=await gateway.execute({context:resolved.context,request});return json({ok:true,...result,text:result.output,provider_state:'verified_for_request',execution:{repositoryMutation:false,repairQueue:'available',mode:'analysis'}});}

Deno.serve(async req=>{const url=new URL(req.url),api=url.searchParams.get('api');try{if(api==='readiness'){const rt=runtime();const state=await providerState(rt.apiKey,'balanced');return json({ok:true,state:'ready',service:'atlas-copilot',version:VERSION,auth:'atlas-session-required-for-prompts',provider:'openai',provider_state:state.state,model:state.probe.model,models:MODELS,api:'responses',reasoning_profiles:{fast:'low',balanced:'medium',deep:'high'},storage_state:rt.storageConfigured?'configured':'not_configured',repositoryMutation:'github-actions-oidc-queue',repairBridge:REPAIR,oracle:ORACLE,checkedAt:new Date().toISOString()});}if(api==='status')return await handleStatus(req);if(api==='history')return await handleHistory(req);if(api==='conversation')return await handleConversation(req,url);if(api==='chat')return await handleChat(req);const html=renderAtlasCopilotPage({supabaseUrl:U,publishableKey:K,selfPath:SELF,repairPath:REPAIR,livePath:LIVE,version:VERSION});return new Response(html,{headers:headers({'content-type':'text/html; charset=utf-8','content-security-policy':`default-src 'self'; connect-src ${U}; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'`})});}catch(error){console.error('atlas_ia_request_failed',{code:error?.code||'internal_error'});return safeError(error);}});
