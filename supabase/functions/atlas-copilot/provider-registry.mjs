const ORDER=Object.freeze(['openai','bedrock','gemini','codex-sovereign']);
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
  async function readiness({profile='balanced'}={}){
    const result=[];
    for(const id of ORDER){
      const adapter=get(id);
      if(!adapter){result.push({id,state:'configuration-required',configured:false,verified:false,model:null,capabilities:[],profiles:[],error:'provider_not_configured'});continue;}
      const descriptor=safeDescriptor(adapter);let probe;
      try{probe=await adapter.probe({profile});}catch(error){probe={configured:descriptor.configured,verified:false,provider:id,model:descriptor.model||descriptor.models?.[profile]||null,error:error?.code||'provider_unavailable'};}
      result.push({
        id,
        state:stateFor(probe),
        configured:probe?.configured===true,
        verified:probe?.verified===true,
        model:probe?.model||descriptor.model||descriptor.models?.[profile]||null,
        capabilities:descriptor.capabilities,
        profiles:descriptor.profiles,
        api:descriptor.api,
        backend:descriptor.backend,
        endpoint:descriptor.endpoint,
        region:descriptor.region,
        feature_support:descriptor.feature_support,
        prompt_cache:descriptor.prompt_cache,
        error:probe?.error||null
      });
    }
    return result;
  }
  return Object.freeze({get,readiness,ids:()=>ORDER.filter(id=>map.has(id))});
}
