function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function requireContext(context){if(!context?.organization_id||!context?.user_id)throw fail('invalid_agent_context',400);const permissions=Array.isArray(context?.permissions)?context.permissions:[];if(!permissions.includes('*')&&!permissions.includes('intelligence.use'))throw fail('permission_denied',403);return context;}
function cleanId(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function providerName(adapter){try{return adapter?.descriptor?.()?.id||'openai';}catch{return'openai';}}
function sessionMeta(row){const meta=row?.usage?.atlas_agent_session;if(!meta||typeof meta!=='object'||!cleanId(meta.provider_session_id))throw fail('session_not_found',404);return meta;}
function approvalFor(action){if(action?.type!=='computer_use_approval_request')return null;const request=action?.request&&typeof action.request==='object'?action.request:{};return {status:'approval_required',request_id:cleanId(action.request_id),risk_class:'computer_use',action_type:request.type||'computer_use',origin:request.origin||null,reason:request.reason||null};}
function safeStatus(value,fallback='ready'){return typeof value==='string'&&value.trim()?value.trim():fallback;}
function capabilities({computer_use,multi_agent}){const out=['agent_session'];if(computer_use)out.push('computer_use');if(multi_agent)out.push('multi_agent');return out;}
function validateApproval(response){if(!response||typeof response!=='object')throw fail('invalid_input',400);const type=response.type;if(type==='browser_origin_access'){if(!['approve','deny','cancel'].includes(response.decision))throw fail('invalid_input',400);return response;}if(type==='browser_authentication'){if(!['submit','cancel'].includes(response.action))throw fail('invalid_input',400);return response;}throw fail('invalid_input',400);}
export function createAgentSessionRuntime({adapter,store,idFactory=()=>crypto.randomUUID()}={}){
  if(!adapter||!store)throw new TypeError('agent_session_dependencies_required');
  const provider=providerName(adapter);
  async function load({context,session_id}){const c=requireContext(context),id=cleanId(session_id);if(!id)throw fail('invalid_input',400);const row=await store.getRequestByTrace({context:c,trace_id:id});return {context:c,atlas_session_id:id,row,meta:sessionMeta(row)};}
  async function createSession({context,profile='balanced',instructions='',computer_use=false,multi_agent=false,max_concurrent_subagents=3,network_allowlist=[]}={}){
    const c=requireContext(context),atlasSessionId=cleanId(idFactory());if(!atlasSessionId)throw fail('internal_error',500);
    const conversation=await store.createConversation({context:c,module:'atlas-agent',title:'Agent session'});
    const request=await store.startRequest({context:c,trace_id:atlasSessionId,conversation_id:conversation?.id||null,module:'agent-session',intent:'agent_session_create',capabilities_requested:capabilities({computer_use,multi_agent})});
    const started=Date.now();
    try{
      const remote=await adapter.createSession({profile,instructions,computer_use,multi_agent,max_concurrent_subagents,network_allowlist});
      const meta={provider_session_id:remote.session_id,provider,model:remote.model||null,profile,status:safeStatus(remote.status,'provisioning'),environment_id:remote.environment_id||null,computer_use:Boolean(computer_use),multi_agent:Boolean(multi_agent)};
      await store.markBackgroundStarted({context:c,id:request.id,provider,model:remote.model||null,usage:{atlas_agent_session:meta}});
      return {session_id:atlasSessionId,status:meta.status,provider,model:meta.model,conversation_id:conversation?.id||null,capabilities:capabilities({computer_use,multi_agent})};
    }catch(error){if(request?.id&&typeof store.failRequest==='function')await store.failRequest({context:c,id:request.id,error_code:error?.code||'provider_unavailable',latency_ms:Date.now()-started}).catch(()=>{});throw error;}
  }
  async function getSession({context,session_id}={}){
    const loaded=await load({context,session_id});const remote=await adapter.retrieveSession({session_id:loaded.meta.provider_session_id});
    const approvals=(Array.isArray(remote?.required_actions)?remote.required_actions:[]).map(approvalFor).filter(Boolean);
    return {session_id:loaded.atlas_session_id,status:safeStatus(remote?.status,loaded.meta.status||'ready'),provider:loaded.meta.provider||provider,model:remote?.agent?.model||loaded.meta.model||null,approvals};
  }
  async function runTurn({context,session_id,text,idempotency_key}={}){
    const loaded=await load({context,session_id});const result=await adapter.sendInput({session_id:loaded.meta.provider_session_id,text,idempotency_key});
    return {session_id:loaded.atlas_session_id,status:safeStatus(result?.status,result?.accepted===false?'rejected':'accepted')};
  }
  async function submitApproval({context,session_id,request_id,response}={}){
    const loaded=await load({context,session_id});const normalized=validateApproval(response);const result=await adapter.submitApproval({session_id:loaded.meta.provider_session_id,request_id,response:normalized});
    return {session_id:loaded.atlas_session_id,request_id,status:safeStatus(result?.status,result?.accepted===false?'rejected':'accepted')};
  }
  async function closeSession({context,session_id}={}){
    const loaded=await load({context,session_id});await adapter.deleteSession({session_id:loaded.meta.provider_session_id});
    if(typeof store.completeRequest==='function')await store.completeRequest({context:loaded.context,id:loaded.row.id,provider:loaded.meta.provider||provider,model:loaded.meta.model||null,capabilities_used:capabilities(loaded.meta),usage:{...(loaded.row?.usage||{}),atlas_agent_session:{...loaded.meta,status:'closed'}},latency_ms:0});
    return {session_id:loaded.atlas_session_id,status:'closed'};
  }
  return Object.freeze({createSession,getSession,runTurn,submitApproval,closeSession});
}
