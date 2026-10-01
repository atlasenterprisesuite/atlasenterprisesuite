import {normalizeAgentContext} from './agentic-core.mjs';
import {evaluateEmergencyFallbackPolicy,evaluateIntelligenceCostPolicy} from './cost-policy.mjs';
import {normalizeIntelligenceError,normalizeIntelligenceRequest} from './intelligence-gateway.mjs';
import {buildSovereignBrainInstructions} from './sovereign-brain-prompt.mjs';

function fail(code,status=400,details={}){return Object.assign(new Error(code),{code,status,...details});}
function has(context,permission){return Array.isArray(context?.permissions)&&(context.permissions.includes(permission)||context.permissions.includes('*'));}
function sse(event,data){return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;}
function outputText(data){
  const out=[];
  if(typeof data?.output_text==='string'&&data.output_text.trim())out.push(data.output_text.trim());
  for(const item of data?.output||[]){
    for(const part of item?.content||[]){
      if(typeof part?.text==='string'&&part.text)out.push(String(part.text));
    }
  }
  return out.join('\n').trim();
}
function eventFrames(buffer){
  const frames=[];
  let rest=buffer.replace(/\r\n/g,'\n');
  let index;
  while((index=rest.indexOf('\n\n'))>=0){
    frames.push(rest.slice(0,index));
    rest=rest.slice(index+2);
  }
  return {frames,rest};
}
function parseFrame(frame){
  let event='';
  const data=[];
  for(const line of String(frame||'').split('\n')){
    if(line.startsWith('event:'))event=line.slice(6).trim();
    else if(line.startsWith('data:'))data.push(line.slice(5).trimStart());
  }
  const raw=data.join('\n');
  let payload=null;
  if(raw&&raw!=='[DONE]'){try{payload=JSON.parse(raw);}catch{payload={type:event||'message',raw};}}
  return {event:event||payload?.type||'',payload,done:raw==='[DONE]'};
}
function completedPayload(payload){
  if(payload?.response&&typeof payload.response==='object')return payload.response;
  if(payload&&typeof payload==='object')return payload;
  return {};
}

export function createStreamingGateway({router,registry,store,costPolicy,clock=Date.now}={}){
  if(!router||!registry||!store)throw new TypeError('streaming_gateway_dependencies_required');
  const effectiveCostPolicy=costPolicy||{allowed_providers:[],allow_paid_single:false,allow_council:false,zero_cost_providers:[],enforce_zero_cost:true};

  async function prepare({context,request}){
    const principal=normalizeAgentContext(context);
    if(!has(principal,'intelligence.use'))throw fail('permission_denied',403);
    const normalized=normalizeIntelligenceRequest(request);
    const route=router.route(normalized);
    if(route.mode==='council')throw fail('streaming_mode_unavailable',409,{mode:'council'});

    const trace_id=crypto.randomUUID();
    const started=clock();
    let conversation=null,telemetry=null;
    try{
      conversation=normalized.conversation_id
        ?await store.getConversation({context:principal,id:normalized.conversation_id})
        :await store.createConversation({context:principal,module:normalized.module,title:normalized.message.slice(0,80)});
      await store.appendMessage({context:principal,conversation_id:conversation.id,role:'user',content:{text:normalized.message},trace_id});
      telemetry=await store.startRequest({context:principal,trace_id,conversation_id:conversation.id,module:normalized.module,intent:normalized.intent,capabilities_requested:normalized.capabilities_requested});
      const messages=await store.listMessages({context:principal,conversation_id:conversation.id,limit:50});
      const history=messages.map(message=>({role:message.role,content:message.content?.text??message.content}));
      if(normalized.legacy_context)history.push({role:'user',content:`Current ATLAS context:\n${normalized.legacy_context}`});
      const instructions=buildSovereignBrainInstructions({module:normalized.module,mode:route.mode,intent:normalized.intent});
      const candidates=route.mode==='auto'
        ?[route.providers[0],...(Array.isArray(route.fallback_providers)?route.fallback_providers:[])]
        :[route.providers[0]];
      const attempts=[];
      let selected=null,lastRetryable=null,lastBlocking=null;

      for(let index=0;index<candidates.length;index+=1){
        const providerId=candidates[index];
        const adapter=registry.get(providerId);
        if(!adapter||typeof adapter.executeStream!=='function'){
          attempts.push({provider:providerId,outcome:'streaming_unavailable'});
          continue;
        }
        let decision=evaluateIntelligenceCostPolicy({mode:index===0?route.mode:'auto',providers:[providerId],policy:effectiveCostPolicy});
        let emergencyReservation=null,emergencyFallback=false;
        if(decision.decision!=='allow'){
          const emergency=index>0&&route.mode==='auto'
            ?evaluateEmergencyFallbackPolicy({provider:providerId,policy:effectiveCostPolicy})
            :{decision:'deny',reason:'emergency_fallback_not_applicable'};
          if(emergency.decision!=='allow'){
            attempts.push({provider:providerId,outcome:decision.decision,reason:decision.reason,emergency_reason:emergency.reason});
            continue;
          }
          if(typeof store.reserveEmergencyBudget!=='function'){
            lastBlocking=fail('emergency_budget_unavailable',503,{provider:providerId});
            continue;
          }
          const reservation=await store.reserveEmergencyBudget({
            context:principal,
            trace_id,
            provider:providerId,
            reserve_usd:emergency.reserve_usd,
            daily_budget_usd:emergency.daily_budget_usd
          });
          if(reservation?.allowed!==true){
            lastBlocking=fail('emergency_budget_exhausted',429,{provider:providerId});
            continue;
          }
          emergencyReservation=reservation;
          emergencyFallback=true;
          decision={...emergency,estimated_automatic_cost_usd:Number(emergency.reserve_usd)};
        }

        const candidateRoute=Object.freeze({
          ...route,
          providers:[providerId],
          provider:providerId,
          fallback_used:index>0||route.fallback_used,
          reason:emergencyFallback?'stream_emergency_fallback':index>0?'stream_runtime_fallback':route.reason
        });
        try{
          const source=await adapter.executeStream({
            context:principal,
            route:candidateRoute,
            instructions,
            input:history,
            max_output_tokens:emergencyFallback?Math.max(64,Math.min(3000,Number(effectiveCostPolicy.emergency_openai_max_output_tokens)||512)):3000
          });
          selected={providerId,adapter,source,route:candidateRoute,costDecision:decision,emergencyReservation};
          attempts.push({provider:providerId,outcome:'stream_started',...(emergencyReservation?{emergency:true}:{})});
          break;
        }catch(error){
          const code=normalizeIntelligenceError(error).code;
          attempts.push({provider:providerId,outcome:code});
          if(route.mode!=='auto'||!['provider_unavailable','provider_rate_limited','streaming_unavailable'].includes(code))throw error;
          lastRetryable=error;
        }
      }

      if(!selected){
        if(lastBlocking)throw lastBlocking;
        if(lastRetryable)throw lastRetryable;
        throw fail('streaming_unavailable',409,{attempts});
      }

      const routing={
        mode:selected.route.mode,
        providers:selected.route.providers,
        profile:selected.route.profile,
        fallback_used:selected.route.fallback_used,
        reason:selected.route.reason,
        cost_decision:selected.costDecision.reason,
        automatic_api_cost_usd:Number.isFinite(selected.costDecision.estimated_automatic_cost_usd)?selected.costDecision.estimated_automatic_cost_usd:null,
        fallback_attempts:attempts,
        streaming:true
      };
      const encoder=new TextEncoder();
      const source=selected.source;
      let completed=false;
      const stream=new ReadableStream({
        async start(controller){
          const send=(event,data)=>controller.enqueue(encoder.encode(sse(event,data)));
          send('meta',{
            trace_id,
            conversation_id:conversation.id,
            provider:selected.providerId,
            model:source.model||null,
            mode:selected.route.mode,
            profile:selected.route.profile
          });
          try{
            if(source.kind==='complete'){
              const text=String(source.text||'').trim();
              if(!text)throw fail('assistant_empty_response',500,{provider:selected.providerId});
              send('delta',{delta:text});
              const latency=Math.max(0,clock()-started);
              await store.appendMessage({context:principal,conversation_id:conversation.id,role:'assistant',content:{text,routing},provenance:source.provenance||[],trace_id});
              await store.completeRequest({context:principal,id:telemetry.id,provider:selected.providerId,model:source.model||null,capabilities_used:selected.route.capabilities,usage:{...(source.usage||{}),atlas_routing:routing},latency_ms:latency});
              completed=true;
              send('completed',{trace_id,conversation_id:conversation.id,provider:selected.providerId,model:source.model||null,text,latency});
              controller.close();
              return;
            }

            const reader=source.stream?.getReader?.();
            if(!reader)throw fail('streaming_unavailable',409,{provider:selected.providerId});
            const decoder=new TextDecoder();
            let buffer='',text='',model=source.model||null,responseId=null,usage={};
            while(true){
              const {done,value}=await reader.read();
              if(done)break;
              buffer+=decoder.decode(value,{stream:true});
              const parsed=eventFrames(buffer);
              buffer=parsed.rest;
              for(const frame of parsed.frames){
                const item=parseFrame(frame);
                if(item.done)continue;
                const eventType=String(item.payload?.type||item.event||'');
                if(eventType==='response.output_text.delta'||eventType==='output_text.delta'){
                  const delta=String(item.payload?.delta||'');
                  if(delta){text+=delta;send('delta',{delta});}
                }else if(eventType==='response.completed'||eventType==='completed'){
                  const response=completedPayload(item.payload);
                  model=String(response?.model||model||'')||null;
                  responseId=String(response?.id||responseId||'')||null;
                  usage=response?.usage&&typeof response.usage==='object'?response.usage:usage;
                  if(!text)text=outputText(response);
                  completed=true;
                }else if(eventType==='response.failed'||eventType==='response.incomplete'||eventType==='error'){
                  const code=String(item.payload?.error?.code||item.payload?.code||'provider_unavailable');
                  throw fail(code,502,{provider:selected.providerId});
                }
              }
            }
            if(buffer.trim()){
              const item=parseFrame(buffer);
              const eventType=String(item.payload?.type||item.event||'');
              if(eventType==='response.output_text.delta'||eventType==='output_text.delta'){
                const delta=String(item.payload?.delta||'');
                if(delta){text+=delta;send('delta',{delta});}
              }else if(eventType==='response.completed'||eventType==='completed'){
                const response=completedPayload(item.payload);
                model=String(response?.model||model||'')||null;
                responseId=String(response?.id||responseId||'')||null;
                usage=response?.usage&&typeof response.usage==='object'?response.usage:usage;
                if(!text)text=outputText(response);
                completed=true;
              }
            }
            text=text.trim();
            if(!completed||!text)throw fail('stream_incomplete',502,{provider:selected.providerId,response_id:responseId});
            const latency=Math.max(0,clock()-started);
            await store.appendMessage({context:principal,conversation_id:conversation.id,role:'assistant',content:{text,routing},provenance:[],trace_id});
            await store.completeRequest({context:principal,id:telemetry.id,provider:selected.providerId,model,capabilities_used:selected.route.capabilities,usage:{...usage,atlas_routing:routing},latency_ms:latency});
            send('completed',{trace_id,conversation_id:conversation.id,provider:selected.providerId,model,text,latency,response_id:responseId});
            controller.close();
          }catch(error){
            const normalizedError=normalizeIntelligenceError(error);
            const latency=Math.max(0,clock()-started);
            if(telemetry?.id)await store.failRequest({context:principal,id:telemetry.id,error_code:normalizedError.code,latency_ms:latency}).catch(()=>{});
            try{send('error',{error:normalizedError.code,trace_id,conversation_id:conversation.id});}catch{}
            controller.close();
          }
        },
        async cancel(){
          if(!completed&&telemetry?.id){
            const latency=Math.max(0,clock()-started);
            await store.failRequest({context:principal,id:telemetry.id,error_code:'stream_cancelled',latency_ms:latency}).catch(()=>{});
          }
        }
      });
      return {stream,trace_id,conversation_id:conversation.id,provider:selected.providerId,model:selected.source.model||null};
    }catch(error){
      const normalizedError=normalizeIntelligenceError(error),latency=Math.max(0,clock()-started);
      if(telemetry?.id)await store.failRequest({context:principal,id:telemetry.id,error_code:normalizedError.code,latency_ms:latency}).catch(()=>{});
      throw Object.assign(new Error(normalizedError.code),{...normalizedError,trace_id});
    }
  }

  return Object.freeze({prepare});
}
