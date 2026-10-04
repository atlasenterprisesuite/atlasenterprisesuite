function fail(code,status=409,details={}){return Object.assign(new Error(code),{code,status,...details});}

export function normalizeModelPin(value){
  return typeof value==='string'&&value.trim()?value.trim():null;
}

function configuredModelFor(provider,profile){
  return normalizeModelPin(provider?.model)||normalizeModelPin(provider?.models?.[profile]);
}

function modelStateFor(provider){
  if(typeof provider?.model_verification_state==='string'&&provider.model_verification_state.trim())return provider.model_verification_state.trim();
  return provider?.verified===true?'verified':'unverified';
}

export function selectVerifiedModel({provider,profile='balanced',explicitModel=null,allowedModels=[]}={}){
  const providerId=typeof provider?.id==='string'?provider.id:null;
  const pin=normalizeModelPin(explicitModel);
  const configuredModel=configuredModelFor(provider,profile);
  const allowlist=Array.isArray(allowedModels)?allowedModels.map(normalizeModelPin).filter(Boolean):[];

  if(pin&&configuredModel!==pin)throw fail('model_unavailable',409,{provider:providerId,model:pin,configured_model:configuredModel});

  const model=pin||configuredModel;
  if(!model){
    if(allowlist.length)throw fail('model_not_allowed',403,{provider:providerId,model:null});
    return Object.freeze({model:null,verification_state:null,reason:'provider_model_unreported'});
  }

  if(allowlist.length&&!allowlist.includes(`${providerId}/${model}`))throw fail('model_not_allowed',403,{provider:providerId,model});

  const verificationState=modelStateFor(provider);
  if(provider?.verified!==true||verificationState!=='verified')throw fail('model_unavailable',409,{provider:providerId,model,verification_state:verificationState});

  return Object.freeze({model,verification_state:'verified',reason:pin?'explicit_verified_model':'profile_verified_model'});
}
