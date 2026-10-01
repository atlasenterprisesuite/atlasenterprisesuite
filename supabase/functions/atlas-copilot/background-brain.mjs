import {evaluateIntelligenceCostPolicy} from './cost-policy.mjs';
import {normalizeIntelligenceRequest} from './intelligence-gateway.mjs';
import {buildSovereignBrainInstructions} from './sovereign-brain-prompt.mjs';

function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function has(context,permission){return Array.isArray(context?.permissions)&&(context.permissions.includes(permission)||context.permissions.includes('*'));}

export function shouldRunInBackground({executionMode='auto',message='',profile='balanced'}={}){
  if(executionMode==='background')return true;
  if(executionMode==='interactive')return false;
  const text=String(message||'').trim();
  if(profile==='deep')return true;
  if(text.length>=1800)return true;
  const longWork=/\b(deep research|research thoroughly|investig(?:a|ate|aci[oó]n)|anal(?:iza|yze).{0,40}(?:fondo|deep|completo|complete)|audit(?:ar)?|revis(?:a|e|ar).{0,40}(?:todo|complete|full)|777\s*review|g[eé]nesis|long[- ]running|background|segundo plano)\b/i;
  return text.length>=320&&longWork.test(text);
}

function terminalFailure(status){
  return ['failed','cancelled','incomplete'].includes(String(status||'').toLowerCase());
}

export function createBackgroundBrain({router,registry,store,costPolicy,runDetached=null,clock=Date.now,staleAfterMs=180000}={}){
  if(!registry||!store)throw new TypeError('background_brain_dependencies_required');

  async function finalize({context,requestRow,providerResult,routing}){
    const conversationId=String(requestRow.conversation_id||'');
    const traceId=String(requestRow.trace_id||'');
    if(!conversationId||!traceId)throw fail('background_request_invalid',500);
    const latest=await store.getRequestByTrace({context,trace_id:traceId});
    if(latest.status==='cancelled')return {status:'cancelled',background:true,trace_id:traceId,conversation_id:conversationId,provider:latest.provider||requestRow.provider||null,text:null};
    const existing=await store.findAssistantMessageByTrace({context,conversation_id:conversationId,trace_id:traceId});
    const text=String(providerResult?.text||'').trim();
    if(!text)throw fail('internal_error',500,{provider:providerResult?.provider||requestRow.provider||null});
    if(!existing){
      await store.appendMessage({
        context,
        conversation_id:conversationId,
        role:'assistant',
        content:{text,routing,background:true},
        provenance:[],
        trace_id:traceId
      });
    }
    const startedAt=new Date(String(requestRow.created_at||'')).getTime();
    const latency=Number.isFinite(startedAt)?Math.max(0,clock()-startedAt):0;
    const usage={
      ...(providerResult?.usage&&typeof providerResult.usage==='object'?providerResult.usage:{}),
      atlas_background:{response_id:providerResult.response_id,status:'completed'},
      atlas_routing:routing
    };
    await store.completeRequest({
      context,
      id:requestRow.id,
      provider:providerResult.provider||requestRow.provider,
      model:providerResult.model||requestRow.model||null,
      capabilities_used:Array.isArray(requestRow.capabilities_requested)?requestRow.capabilities_requested:['generation'],
      usage,
      latency_ms:latency
    });
    return {status:'completed',background:true,trace_id:traceId,conversation_id:conversationId,provider:providerResult.provider||requestRow.provider,model:providerResult.model||requestRow.model||null,text};
  }

  async function start({context,request}){
    if(!router)throw new TypeError('background_router_required');
    if(!has(context,'intelligence.use'))throw fail('permission_denied',403);
    const normalized=normalizeIntelligenceRequest(request);
    const route=router.route(normalized);
    if(route.mode==='council')throw fail('background_provider_unavailable',409,{mode:'council'});
    const candidates=route.mode==='auto'
      ?[route.providers[0],...(Array.isArray(route.fallback_providers)?route.fallback_providers:[])]
      :[route.providers[0]];
    let selected=null,costDecision=null;
    for(const providerId of candidates){
      const adapter=registry.get(providerId);
      const nativeBackground=typeof adapter?.startBackground==='function';
      const detachedBackground=typeof runDetached==='function'&&typeof adapter?.execute==='function';
      if(!adapter||(!nativeBackground&&!detachedBackground))continue;
      const decision=evaluateIntelligenceCostPolicy({
        mode:route.mode==='auto'?'auto':route.mode,
        providers:[providerId],
        policy:costPolicy||{}
      });
      if(decision.decision==='allow'){
        selected={providerId,adapter};
        costDecision=decision;
        break;
      }
    }
    if(!selected)throw fail('background_provider_unavailable',409);

    const conversation=normalized.conversation_id
      ?await store.getConversation({context,id:normalized.conversation_id})
      :await store.createConversation({context,module:normalized.module,title:normalized.message.slice(0,80)});
    const traceId=crypto.randomUUID();
    await store.appendMessage({context,conversation_id:conversation.id,role:'user',content:{text:normalized.message},trace_id:traceId});
    const telemetry=await store.startRequest({
      context,
      trace_id:traceId,
      conversation_id:conversation.id,
      module:normalized.module,
      intent:normalized.intent,
      capabilities_requested:normalized.capabilities_requested
    });
    const messages=await store.listMessages({context,conversation_id:conversation.id,limit:50});
    const history=messages.map(message=>({role:message.role,content:message.content?.text??message.content}));
    if(normalized.legacy_context)history.push({role:'user',content:`Current ATLAS context:\n${normalized.legacy_context}`});
    const candidateRoute=Object.freeze({
      ...route,
      providers:[selected.providerId],
      provider:selected.providerId,
      fallback_used:selected.providerId!==route.providers[0]||route.fallback_used,
      reason:selected.providerId!==route.providers[0]?'background_capable_provider':'background_primary_provider'
    });
    const routing={
      mode:candidateRoute.mode,
      providers:[selected.providerId],
      profile:candidateRoute.profile,
      fallback_used:candidateRoute.fallback_used,
      reason:candidateRoute.reason,
      cost_decision:costDecision?.reason||null,
      automatic_api_cost_usd:Number.isFinite(costDecision?.estimated_automatic_cost_usd)?costDecision.estimated_automatic_cost_usd:null,
      background:true
    };
    try{
      const instructions=buildSovereignBrainInstructions({module:normalized.module,mode:candidateRoute.mode,intent:normalized.intent});
      if(typeof selected.adapter.startBackground==='function'){
        const result=await selected.adapter.startBackground({
          context,
          route:candidateRoute,
          instructions,
          input:history,
          max_output_tokens:3000
        });
        await store.markBackgroundStarted({
          context,
          id:telemetry.id,
          provider:result.provider||selected.providerId,
          model:result.model||null,
          usage:{...(result.usage||{}),atlas_background:{response_id:result.response_id,status:result.status||'queued',kind:'provider-native'},atlas_routing:routing}
        });
        const requestRow={...telemetry,provider:result.provider||selected.providerId,model:result.model||null,usage:{atlas_background:{response_id:result.response_id,status:result.status||'queued',kind:'provider-native'},atlas_routing:routing}};
        if(result.status==='completed'){
          return finalize({context,requestRow,providerResult:result,routing});
        }
        return {
          status:result.status||'queued',
          background:true,
          trace_id:traceId,
          conversation_id:conversation.id,
          provider:result.provider||selected.providerId,
          model:result.model||null,
          text:''
        };
      }

      const responseId=`atlas-detached:${traceId}`;
      await store.markBackgroundStarted({
        context,
        id:telemetry.id,
        provider:selected.providerId,
        model:null,
        usage:{atlas_background:{response_id:responseId,status:'in_progress',kind:'edge-detached'},atlas_routing:routing}
      });
      const requestRow={...telemetry,provider:selected.providerId,model:null,usage:{atlas_background:{response_id:responseId,status:'in_progress',kind:'edge-detached'},atlas_routing:routing}};
      const task=(async()=>{
        try{
          const result=await selected.adapter.execute({
            context,
            route:candidateRoute,
            instructions,
            input:history,
            max_output_tokens:3000,
            background:true
          });
          await finalize({
            context,
            requestRow:{...requestRow,model:result.model||null},
            providerResult:{...result,response_id:responseId,status:'completed'},
            routing
          });
        }catch(error){
          const startedAt=new Date(String(requestRow.created_at||'')).getTime();
          const latency=Number.isFinite(startedAt)?Math.max(0,clock()-startedAt):0;
          await store.failRequest({context,id:requestRow.id,error_code:error?.code||'background_failed',latency_ms:latency}).catch(()=>{});
        }
      })();
      runDetached(task);
      return {
        status:'in_progress',
        background:true,
        trace_id:traceId,
        conversation_id:conversation.id,
        provider:selected.providerId,
        model:null,
        text:''
      };
    }catch(error){
      const startedAt=new Date(String(telemetry?.created_at||'')).getTime();
      const latency=Number.isFinite(startedAt)?Math.max(0,clock()-startedAt):0;
      await store.failRequest({context,id:telemetry.id,error_code:error?.code||'provider_unavailable',latency_ms:latency}).catch(()=>{});
      throw error;
    }
  }

  async function poll({context,traceId}){
    if(!has(context,'intelligence.use'))throw fail('permission_denied',403);
    const requestRow=await store.getRequestByTrace({context,trace_id:traceId});
    if(requestRow.status==='completed'){
      const persisted=await store.findAssistantMessageByTrace({
        context,
        conversation_id:String(requestRow.conversation_id||''),
        trace_id:traceId
      });
      const text=String(persisted?.content?.text||'').trim()||null;
      return {status:'completed',background:true,trace_id:traceId,conversation_id:requestRow.conversation_id,provider:requestRow.provider,model:requestRow.model||null,text,persisted:true};
    }
    if(requestRow.status==='failed'){
      const workHandoff=requestRow?.usage?.atlas_background?.work_handoff||null;
      const error=String(requestRow.error_code||'background_failed');
      return {status:'failed',background:true,trace_id:traceId,conversation_id:requestRow.conversation_id,provider:requestRow.provider,error,handoff_required:error==='background_stale'&&!workHandoff,work_handoff:workHandoff};
    }
    if(requestRow.status==='cancelled')return {status:'cancelled',background:true,trace_id:traceId,conversation_id:requestRow.conversation_id,provider:requestRow.provider,error:requestRow.error_code||'background_cancelled'};
    const background=requestRow?.usage?.atlas_background;
    const responseId=String(background?.response_id||'').trim();
    const providerId=String(requestRow.provider||'').trim();
    if(background?.kind==='edge-detached'){
      const startedAt=new Date(String(requestRow.created_at||'')).getTime();
      const ageMs=Number.isFinite(startedAt)?Math.max(0,clock()-startedAt):0;
      if(ageMs>=Math.max(60000,Number(staleAfterMs)||180000)){
        await store.failRequest({context,id:requestRow.id,error_code:'background_stale',latency_ms:ageMs});
        return {status:'failed',background:true,trace_id:traceId,conversation_id:requestRow.conversation_id,provider:providerId,model:requestRow.model||null,text:null,error:'background_stale',handoff_required:true};
      }
      return {status:'in_progress',background:true,trace_id:traceId,conversation_id:requestRow.conversation_id,provider:providerId,model:requestRow.model||null,text:null};
    }
    const adapter=registry.get(providerId);
    if(!responseId||!adapter||typeof adapter.retrieveBackground!=='function')throw fail('background_request_invalid',409);
    let providerResult;
    try{
      providerResult=await adapter.retrieveBackground({response_id:responseId});
    }catch(error){
      if(error?.code==='provider_unavailable'||error?.code==='provider_rate_limited')throw error;
      const startedAt=new Date(String(requestRow.created_at||'')).getTime();
      const latency=Number.isFinite(startedAt)?Math.max(0,clock()-startedAt):0;
      await store.failRequest({context,id:requestRow.id,error_code:error?.code||'background_failed',latency_ms:latency}).catch(()=>{});
      throw error;
    }
    const routing=requestRow?.usage?.atlas_routing&&typeof requestRow.usage.atlas_routing==='object'
      ?requestRow.usage.atlas_routing
      :{mode:'background',providers:[providerId],profile:requestRow.intent||'balanced',background:true};
    if(providerResult.status==='completed')return finalize({context,requestRow,providerResult,routing});
    if(terminalFailure(providerResult.status)){
      const startedAt=new Date(String(requestRow.created_at||'')).getTime();
      const latency=Number.isFinite(startedAt)?Math.max(0,clock()-startedAt):0;
      const errorCode=providerResult.error||`background_${providerResult.status}`;
      await store.failRequest({context,id:requestRow.id,error_code:errorCode,latency_ms:latency});
      return {status:providerResult.status,background:true,trace_id:traceId,conversation_id:requestRow.conversation_id,provider:providerId,error:errorCode};
    }
    return {status:providerResult.status||'in_progress',background:true,trace_id:traceId,conversation_id:requestRow.conversation_id,provider:providerId,model:providerResult.model||requestRow.model||null,text:null};
  }

  async function cancel({context,traceId}){
    if(!has(context,'intelligence.use'))throw fail('permission_denied',403);
    const requestRow=await store.getRequestByTrace({context,trace_id:traceId});
    if(['completed','failed','cancelled','denied'].includes(String(requestRow.status||''))){
      return {status:requestRow.status,background:true,trace_id:traceId,conversation_id:requestRow.conversation_id,provider:requestRow.provider,error:requestRow.error_code||null};
    }
    const background=requestRow?.usage?.atlas_background;
    const responseId=String(background?.response_id||'').trim();
    const providerId=String(requestRow.provider||'').trim();
    const adapter=registry.get(providerId);
    if(background?.kind==='provider-native'&&responseId&&adapter&&typeof adapter.cancelBackground==='function'){
      await adapter.cancelBackground({response_id:responseId});
    }
    const startedAt=new Date(String(requestRow.created_at||'')).getTime();
    const latency=Number.isFinite(startedAt)?Math.max(0,clock()-startedAt):0;
    await store.cancelRequest({context,id:requestRow.id,error_code:'background_cancelled',latency_ms:latency});
    return {status:'cancelled',background:true,trace_id:traceId,conversation_id:requestRow.conversation_id,provider:providerId||null,error:'background_cancelled'};
  }

  async function activity({context,limit=50}={}){
    if(!has(context,'intelligence.use'))throw fail('permission_denied',403);
    const rows=await store.listBackgroundActivity({context,limit});
    return rows.map(row=>({
      trace_id:String(row.trace_id||''),
      conversation_id:row.conversation_id?String(row.conversation_id):null,
      status:String(row.status||'started'),
      provider:row.provider?String(row.provider):null,
      model:row.model?String(row.model):null,
      created_at:row.created_at?String(row.created_at):null,
      completed_at:row.completed_at?String(row.completed_at):null,
      latency_ms:Number.isFinite(Number(row.latency_ms))?Number(row.latency_ms):null,
      error:row.error_code?String(row.error_code):null,
      kind:String(row?.usage?.atlas_background?.kind||'background')
    }));
  }

  async function reconcileConversation({context,conversationId,limit=8}){
    const pending=await store.listBackgroundRequests({context,conversation_id:conversationId,limit});
    const results=[];
    for(const requestRow of pending){
      try{results.push(await poll({context,traceId:String(requestRow.trace_id)}));}
      catch(error){results.push({status:'error',trace_id:String(requestRow.trace_id),error:error?.code||'background_reconcile_failed'});}
    }
    return results;
  }

  return Object.freeze({start,poll,cancel,activity,reconcileConversation,finalize});
}
