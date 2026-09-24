export function evaluateIntelligenceCostPolicy({mode='auto',providers=[],policy={}}={}){
  const allowed=new Set(Array.isArray(policy.allowed_providers)?policy.allowed_providers:[]);
  const zero=new Set(Array.isArray(policy.zero_cost_providers)?policy.zero_cost_providers:[]);
  const enforceZero=policy.enforce_zero_cost===true;
  if(!Array.isArray(providers)||providers.length===0)return {decision:'deny',reason:'no_provider_selected',providers:[]};
  for(const provider of providers)if(allowed.size&&!allowed.has(provider))return {decision:'deny',reason:'provider_not_allowed',providers:[...providers]};
  if(mode==='council'){
    if(providers.length<2)return {decision:'deny',reason:'council_requires_two_providers',providers:[...providers]};
    if(providers.every(provider=>zero.has(provider)))return {decision:'allow',reason:'zero_cost_council',providers:[...providers],estimated_automatic_cost_usd:0};
    if(enforceZero)return {decision:'deny',reason:'paid_provider_blocked_by_zero_cost_policy',providers:[...providers],estimated_automatic_cost_usd:0};
    if(policy.allow_council===true)return {decision:'allow',reason:'council_pre_authorized',providers:[...providers]};
    return {decision:'approval_required',reason:'council_cost_approval_required',providers:[...providers]};
  }
  if(providers.every(provider=>zero.has(provider)))return {decision:'allow',reason:'zero_cost_provider',providers:[...providers],estimated_automatic_cost_usd:0};
  if(enforceZero)return {decision:'deny',reason:'paid_provider_blocked_by_zero_cost_policy',providers:[...providers],estimated_automatic_cost_usd:0};
  if(policy.allow_paid_single===true)return {decision:'allow',reason:'single_provider_pre_authorized',providers:[...providers]};
  return {decision:'approval_required',reason:'provider_cost_approval_required',providers:[...providers]};
}

export function evaluateEmergencyFallbackPolicy({provider,policy={}}={}){
  const allowed=new Set(Array.isArray(policy.allowed_providers)?policy.allowed_providers:[]);
  const daily=Number(policy.emergency_openai_daily_budget_usd)||0;
  const reserve=Number(policy.emergency_openai_reserve_usd)||0;
  if(provider!=='openai')return {decision:'deny',reason:'emergency_provider_not_allowed',provider};
  if(allowed.size&&!allowed.has(provider))return {decision:'deny',reason:'provider_not_allowed',provider};
  if(policy.emergency_openai_enabled!==true)return {decision:'deny',reason:'emergency_fallback_disabled',provider};
  if(!(daily>0)||!(reserve>0))return {decision:'deny',reason:'emergency_budget_not_configured',provider};
  if(reserve>daily)return {decision:'deny',reason:'emergency_request_exceeds_daily_budget',provider,daily_budget_usd:daily,reserve_usd:reserve};
  return {decision:'allow',reason:'emergency_openai_pre_authorized',provider,daily_budget_usd:daily,reserve_usd:reserve,estimated_automatic_cost_usd:reserve};
}
