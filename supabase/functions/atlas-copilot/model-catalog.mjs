const PROFILE_ORDER=Object.freeze(['fast','balanced','deep']);
const freezeCapabilities=(values)=>Object.freeze([...values]);
const model=(id,capabilities)=>Object.freeze({id,capabilities:freezeCapabilities(capabilities)});
const provider=(profiles)=>Object.freeze(Object.fromEntries(PROFILE_ORDER.map((profile)=>[profile,profiles[profile]])));

export const MODEL_CATALOG=Object.freeze({
  openai:provider({
    fast:model('gpt-6-luna',['generation','reasoning']),
    balanced:model('gpt-6.1-sol',['generation','reasoning','computer_use','multi_agent']),
    deep:model('gpt-6-astra',['generation','reasoning','computer_use','multi_agent']),
  }),
  anthropic:provider({
    fast:model('claude-sonnet-5-5',['generation','reasoning']),
    balanced:model('claude-sonnet-5-5',['generation','reasoning']),
    deep:model('claude-sonnet-5-5',['generation','reasoning']),
  }),
});

export function defaultProfileModels(providerId){
  const entry=MODEL_CATALOG[providerId];
  if(!entry)return null;
  return Object.fromEntries(PROFILE_ORDER.map((profile)=>[profile,entry[profile].id]));
}

export function providerModelMetadata(providerId,modelId){
  const entry=MODEL_CATALOG[providerId];
  if(!entry||!modelId)return null;
  for(const profile of PROFILE_ORDER){
    const candidate=entry[profile];
    if(candidate.id===modelId)return Object.freeze({provider:providerId,profile,id:candidate.id,capabilities:candidate.capabilities});
  }
  return null;
}
