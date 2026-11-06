const ORDER=Object.freeze(['atlas-local','openai','bedrock','gemini','anthropic','grok','deepseek','mistral','qwen','codex-sovereign']);
const SAFE_PROBE_ERRORS=new Set(['provider_not_configured','provider_verification_required','provider_rate_limited','provider_auth_failed','provider_unavailable','capability_unavailable']);
function safeProbeError(error){return SAFE_PROBE_ERRORS.has(error)?error:'provider_unavailable';}
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
    return Promise.all(ORDER.map(async id=>{
      const adapter=get(id);
      if(!adapter)return {id,state:'configuration-required',configured:false,verified:false,model:null,capabilities:[],profiles:[],error:'provider_not_configured'};
      const descriptor=safeDescriptor(adapter);
      const configuredModel=descriptor.models?descriptor.models[profile]||null:descriptor.model||null;
      // A different configured profile cannot authorize this profile.
      if(!descriptor.configured||!descriptor.profiles.includes(profile)||typeof configuredModel!=='string'||!configuredModel.trim()){
        return {id,state:'configuration-required',configured:false,verified:false,model:configuredModel,
          capabilities:descriptor.capabilities,profiles:descriptor.profiles,error:'provider_not_configured'};
      }
      let probe;
      try{probe=await adapter.probe({profile});}
      catch(error){probe={configured:true,verified:false,model:configuredModel,error:safeProbeError(error?.code)};}
      // Never trust a probe claiming success for a different/unconfigured model.
      const verified=probe?.configured===true&&probe?.verified===true&&probe?.model===configuredModel;
      const error=verified?null:(probe?.verified===true?'provider_verification_required':safeProbeError(probe?.error));
      const result={configured:probe?.configured===true,verified,error};
      return {
        id,
        state:stateFor(result),
        configured:result.configured,
        verified,
        model:configuredModel,
        capabilities:descriptor.capabilities,
        profiles:descriptor.profiles,
        api:descriptor.api,
        backend:descriptor.backend,
        endpoint:descriptor.endpoint,
        region:descriptor.region,
        feature_support:descriptor.feature_support,
        prompt_cache:descriptor.prompt_cache,
        error
      };
    }));
  }
  return Object.freeze({get,readiness,ids:()=>ORDER.filter(id=>map.has(id))});
}
