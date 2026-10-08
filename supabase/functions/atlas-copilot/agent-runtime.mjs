function cleanId(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function descriptorOf(runtime){const raw=runtime?.descriptor?.()||{};return {id:cleanId(raw.id),provider:cleanId(raw.provider),enabled:raw.enabled===true,configured:raw.configured===true};}
export function createAgentRuntimeRegistry({runtimes=[]}={}){
  const map=new Map();
  for(const runtime of Array.isArray(runtimes)?runtimes:[]){const descriptor=descriptorOf(runtime);if(descriptor.id&&!map.has(descriptor.id))map.set(descriptor.id,runtime);}
  return Object.freeze({
    get(id){return map.get(cleanId(id))||null;},
    ids(){return [...map.keys()];},
    descriptors(){return [...map.values()].map(runtime=>descriptorOf(runtime));},
  });
}
