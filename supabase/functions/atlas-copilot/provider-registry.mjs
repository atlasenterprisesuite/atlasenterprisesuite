const ORDER=Object.freeze(['atlas-local','openai','bedrock','gemini','codex-sovereign']);
function stateFor(probe){if(probe?.verified===true)return'verified';if(probe?.configured!==true||probe?.error==='provider_not_configured')return'configuration-required';if(probe?.error==='provider_verification_required')return'configured-unverified';if(probe?.error==='provider_rate_limited')return'rate-limited';return'unavailable';}
function safeDescriptor(adapter){
  const raw=adapter?.descriptor?.()||{};
  return {
    id:raw.id||null,
    configured:raw.configured===true,
    capabilities:Array.isArray(raw.capabilities)?[...raw.capabilities]:[],
    profiles:Array.isArray(raw.profiles)?[...raw.profiles]:[],
    model:raw.model||null,
    models:raw.models&&typeof raw.models==='object'?{...raw.models}:undefined,
    model_discovery:Array.isArray(raw.model_discovery)?raw.model_discovery.map(item=>({...item})):undefined,
    api:raw.api||null,
    backend:raw.backend||null,
    endpoint:raw.endpoint||null,
    region:raw.region||null,
    feature_support:raw.feature_support&&typeof raw.feature_support==='object'?{...raw.feature_support}:undefined,
    prompt_cache:raw.prompt_cache&&typeof raw.prompt_cache==='object'?{...raw.prompt_cache}:undefined
  };
}
export function createProviderRegistry({providers=[]}={}){
  const map=new Map();
  for(const adapter of providers){const d=safeDescriptor(adapter);if(ORDER.includes(d.id)&&!map.has(d.id))map.set(d.id,adapter);}
  const get=id=>map.get(id)||null;
  async function readiness({profile='balanced',model=null,provider=null}={}){
    return Promise.all(ORDER.map(async id=>{
      const adapter=get(id);
      if(!adapter)return {id,state:'configuration-required',configured:false,verified:false,model:null,model_verification_state:'configuration-required',capabilities:[],profiles:[],error:'provider_not_configured'};
      const descriptor=safeDescriptor(adapter);let probe;
      const requestedModel=(provider===null||provider===id)?model:null;
      try{probe=await adapter.probe({profile,...(requestedModel?{model:requestedModel}:{})});}catch(error){probe={configured:descriptor.configured,verified:false,provider:id,model:requestedModel||descriptor.model||descriptor.models?.[profile]||null,error:error?.code||'provider_unavailable'};}
      const state=stateFor(probe);
      return {
        id,
        state,
        configured:probe?.configured===true,
        verified:probe?.verified===true,
        model:probe?.model||descriptor.model||descriptor.models?.[profile]||null,
        model_verification_state:probe?.model_verification_state|| (probe?.verified===true?'verified':state),
        model_discovery:descriptor.model_discovery,
        capabilities:descriptor.capabilities,
        profiles:descriptor.profiles,
        api:descriptor.api,
        backend:descriptor.backend,
        endpoint:descriptor.endpoint,
        region:descriptor.region,
        feature_support:descriptor.feature_support,
        prompt_cache:descriptor.prompt_cache,
        error:probe?.error||null
      };
    }));
  }
  return Object.freeze({get,readiness,ids:()=>ORDER.filter(id=>map.has(id))});
}
