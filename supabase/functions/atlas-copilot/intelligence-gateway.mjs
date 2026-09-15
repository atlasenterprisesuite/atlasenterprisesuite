import {normalizeAgentContext} from './agentic-core.mjs';
import {evaluateIntelligenceCostPolicy} from './cost-policy.mjs';

export const INTELLIGENCE_CAPABILITIES=Object.freeze(['generation','reasoning']);
export const REASONING_PROFILES=Object.freeze({fast:Object.freeze({id:'fast'}),balanced:Object.freeze({id:'balanced'}),deep:Object.freeze({id:'deep'})});
export const INTELLIGENCE_PROVIDER_IDS=Object.freeze(['openai','gemini','codex-sovereign']);
export const INTELLIGENCE_MODES=Object.freeze(['auto',...INTELLIGENCE_PROVIDER_IDS,'council']);

function fail(code,status=400,details={}){return Object.assign(new Error(code),{code,status,...details});}
function has(context,permission){return Array.isArray(context?.permissions)&&(context.permissions.includes(permission)||context.permissions.includes('*'));}
function supports(provider,intent,capabilities){return provider?.configured===true&&provider?.verified===true&&capabilities.every(c=>provider.capabilities?.includes(c))&&provider.profiles?.includes(intent);}

export function normalizeIntelligenceRequest(input={}){
  const module=String(input.module||'atlas').trim()||'atlas';
  const intent=String(input.intent||'balanced').trim();
  const mode=String(input.mode||'auto').trim();
  const message=String(input.message||'').trim();
  if(!message)throw fail('invalid_input',400,{field:'message'});
  if(!REASONING_PROFILES[intent])throw fail('invalid_input',400,{field:'intent'});
  if(!INTELLIGENCE_MODES.includes(mode))throw fail('invalid_input',400,{field:'mode'});
  const capabilities_requested=Array.isArray(input.capabilities_requested)&&input.capabilities_requested.length?[...new Set(input.capabilities_requested.map(String))]:['generation'];
  for(const capability of capabilities_requested)if(!INTELLIGENCE_CAPABILITIES.includes(capability))throw fail('capability_unavailable',409,{capability});
  return Object.freeze({module,intent,mode,message,capabilities_requested,conversation_id:input.conversation_id?String(input.conversation_id):null,client_metadata:input.client_metadata&&typeof input.client_metadata==='object'?structuredClone(input.client_metadata):{},legacy_context:input.legacy_context?String(input.legacy_context).slice(0,12000):''});
}

export function createIntelligenceRouter({providers=[]}={}){
  const ordered=[...providers].filter(p=>INTELLIGENCE_PROVIDER_IDS.includes(p?.id));
  return Object.freeze({
    route({mode='auto',intent='balanced',capabilities_requested=['generation']}={}){
      if(!INTELLIGENCE_MODES.includes(mode))throw fail('invalid_input',400,{field:'mode'});
      if(!REASONING_PROFILES[intent])throw fail('invalid_input',400,{field:'intent'});
      const capabilities=[...capabilities_requested];
      if(mode==='council'){
        const compatible=ordered.filter(p=>supports(p,intent,capabilities));
        if(compatible.length<2)throw fail('capability_unavailable',503,{mode:'council',minimum_providers:2});
        return Object.freeze({mode:'council',providers:compatible.map(p=>p.id),provider:compatible[0].id,profile:intent,capabilities,fallback_used:false,reason:'council_verified_capability_match'});
      }
      if(mode!=='auto'){
        const selected=ordered.find(p=>p.id===mode);
        if(!selected||selected.configured!==true)throw fail('provider_not_configured',503,{provider:mode});
        if(!supports(selected,intent,capabilities))throw fail(selected.verified===true?'capability_unavailable':'provider_unavailable',503,{provider:mode});
        return Object.freeze({mode,providers:[selected.id],provider:selected.id,profile:intent,capabilities,fallback_used:false,reason:'explicit_provider'});
      }
      const configured=ordered.filter(p=>p?.configured===true);
      if(!configured.length)throw fail('provider_not_configured',503);
      const index=ordered.findIndex(p=>supports(p,intent,capabilities));
      if(index<0)throw fail('capability_unavailable',503);
      const selected=ordered[index];
      return Object.freeze({mode:'auto',providers:[selected.id],provider:selected.id,profile:intent,capabilities,fallback_used:index>0,reason:index>0?'auto_fallback_to_verified_provider':'auto_primary_verified_provider'});
    },
  });
}

export function normalizeIntelligenceError(error){
  if(error?.code)return {code:error.code,status:Number(error.status)||500,trace_id:error.trace_id||null};
  if(Number(error?.status)===429)return {code:'provider_rate_limited',status:429,trace_id:null};
  if(Number(error?.status)>=500)return {code:'provider_unavailable',status:502,trace_id:null};
  return {code:'internal_error',status:500,trace_id:null};
}

export function createIntelligenceGateway({router,provider,registry,council,store,costPolicy,toolGateway,clock=Date.now}={}){
  if(!router||!store||(!provider&&!registry))throw new TypeError('gateway_dependencies_required');
  const effectiveCostPolicy=costPolicy||{allowed_providers:[],allow_paid_single:true,allow_council:false,zero_cost_providers:[]};
  return Object.freeze({async execute({context,request}){
    const principal=normalizeAgentContext(context);
    if(!has(principal,'intelligence.use'))throw fail('permission_denied',403);
    const normalized=normalizeIntelligenceRequest(request);
    const route=router.route(normalized);
    const costDecision=evaluateIntelligenceCostPolicy({mode:route.mode,providers:route.providers,policy:effectiveCostPolicy});
    if(costDecision.decision==='deny')throw fail(costDecision.reason||'cost_policy_denied',403,{cost_decision:costDecision});
    if(costDecision.decision==='approval_required')throw fail('cost_approval_required',409,{cost_decision:costDecision});
    const trace_id=crypto.randomUUID();
    const started=clock();
    let conversation,telemetry;
    try{
      conversation=normalized.conversation_id?await store.getConversation({context:principal,id:normalized.conversation_id}):await store.createConversation({context:principal,module:normalized.module,title:normalized.message.slice(0,80)});
      await store.appendMessage({context:principal,conversation_id:conversation.id,role:'user',content:{text:normalized.message},trace_id});
      telemetry=await store.startRequest({context:principal,trace_id,conversation_id:conversation.id,module:normalized.module,intent:normalized.intent,capabilities_requested:normalized.capabilities_requested});
      const messages=await store.listMessages({context:principal,conversation_id:conversation.id,limit:50});
      const history=messages.map(m=>({role:m.role,content:m.content?.text??m.content}));
      if(normalized.legacy_context)history.push({role:'user',content:`Current ATLAS context:\n${normalized.legacy_context}`});
      const instructions='You are ATLAS Assistant. Preserve tenant boundaries, permissions, auditability, truthful execution states, and user intent. Never expose secrets or private chain-of-thought.';
      let result;
      if(route.mode==='council'){
        if(!council)throw fail('capability_unavailable',503,{mode:'council'});
        result=await council.execute({providerIds:route.providers,context:principal,route,instructions,input:history,max_output_tokens:3000});
      }else{
        const adapter=registry?.get(route.providers[0])||provider;
        if(!adapter)throw fail('provider_not_configured',503,{provider:route.providers[0]});
        result=await adapter.execute({context:principal,route,instructions,input:history,max_output_tokens:3000});
      }
      const proposals=toolGateway?toolGateway.evaluate({proposals:result.tool_calls||[],context:principal}):{accepted:[],approval_required:[],denied:[]};
      const latency=Math.max(0,clock()-started);
      const routing={mode:route.mode,providers:route.providers,profile:route.profile,fallback_used:route.fallback_used,reason:route.reason};
      await store.appendMessage({context:principal,conversation_id:conversation.id,role:'assistant',content:{text:result.text,routing,contributions:result.contributions?.map(item=>({provider:item.provider,model:item.model}))||[]},provenance:result.provenance||[],trace_id});
      await store.completeRequest({context:principal,id:telemetry.id,provider:result.provider,model:result.model,capabilities_used:result.capabilities_used||route.capabilities,usage:{...(result.usage||{}),atlas_routing:routing},latency_ms:latency});
      return {request_id:principal.request_id,trace_id,conversation_id:conversation.id,status:'completed',output:result.text,provider:result.provider,providers:route.providers,model:result.model,mode:route.mode,profile:route.profile,fallback_used:route.fallback_used,capabilities_used:result.capabilities_used||route.capabilities,tools_used:[],tool_proposals:proposals,contributions:result.contributions?.map(item=>({provider:item.provider,model:item.model,text:item.text}))||[],sources:result.provenance||[],usage:result.usage||{},latency,execution_state:'completed'};
    }catch(error){
      const normalizedError=normalizeIntelligenceError(error),latency=Math.max(0,clock()-started);
      if(telemetry?.id)await store.failRequest({context:principal,id:telemetry.id,error_code:normalizedError.code,latency_ms:latency}).catch(()=>{});
      throw Object.assign(new Error(normalizedError.code),{...normalizedError,trace_id});
    }
  }});
}
