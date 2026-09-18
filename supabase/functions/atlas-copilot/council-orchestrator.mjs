function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
const LABEL=Object.freeze({openai:'OpenAI',gemini:'Gemini','codex-sovereign':'Codex Sovereign'});
function reconcile(contributions){return contributions.map(item=>`### ${LABEL[item.provider]||item.provider}\n${item.text}`).join('\n\n');}
export function createCouncilOrchestrator({registry}={}){
  if(!registry)throw new TypeError('council_registry_required');
  async function execute({providerIds=[],context,route,instructions,input,max_output_tokens=3000,store=false}={}){
    const ids=[...new Set(providerIds)];
    if(ids.length<2)throw fail('capability_unavailable',503,{minimum_providers:2});
    const settled=await Promise.allSettled(ids.map(async id=>{
      const adapter=registry.get(id);
      if(!adapter)throw fail('provider_not_configured',503,{provider:id});
      return adapter.execute({context,route:{...route,mode:'council',providers:ids,provider:id},instructions,input,max_output_tokens,store});
    }));
    const contributions=[];const failures=[];
    for(let i=0;i<settled.length;i++){
      const item=settled[i];
      if(item.status==='fulfilled')contributions.push({...item.value,provider:ids[i]});
      else failures.push({provider:ids[i],error:item.reason?.code||'provider_unavailable'});
    }
    if(contributions.length<2)throw fail('provider_unavailable',502,{failures});
    const usage={by_provider:Object.fromEntries(contributions.map(item=>[item.provider,item.usage||{}]))};
    const provenance=contributions.flatMap(item=>(item.provenance||[]).map(source=>({provider:item.provider,source})));
    const tool_calls=contributions.flatMap(item=>(item.tool_calls||[]).map(call=>({...call,provider:item.provider})));
    return {provider:'atlas-council',model:null,text:reconcile(contributions),contributions,failures,capabilities_used:[...(route?.capabilities||['generation'])],usage,provenance,tool_calls};
  }
  return Object.freeze({execute});
}
