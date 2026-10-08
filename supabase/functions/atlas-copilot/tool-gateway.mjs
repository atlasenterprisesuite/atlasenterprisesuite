function stable(value){if(Array.isArray(value))return`[${value.map(stable).join(',')}]`;if(value&&typeof value==='object')return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;return JSON.stringify(value);}
function hash(value){let h=2166136261;for(const ch of value){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return`atlas_${(h>>>0).toString(16).padStart(8,'0')}`;}
function has(context,permission){const permissions=Array.isArray(context?.permissions)?context.permissions:[];return permissions.includes('*')||permissions.includes(permission);}
function clean(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function normalizeDomain(value){const direct=clean(value);if(!direct)return null;try{return new URL(direct.includes('://')?direct:`https://${direct}`).hostname.toLowerCase();}catch{return null;}}
function domainFromArguments(args={}){for(const key of ['url','target_url','origin']){const domain=normalizeDomain(args?.[key]);if(domain)return domain;}return null;}
function proposalCore(item){return {tool_name:item.tool_name,arguments:item.arguments,risk_class:item.risk_class,required_permissions:item.required_permissions,side_effect:item.side_effect,cost_class:item.cost_class};}
function normalize(raw={}){
  const tool_name=String(raw.tool_name||'').trim();
  const args=raw.arguments&&typeof raw.arguments==='object'?structuredClone(raw.arguments):{};
  const required_permissions=Array.isArray(raw.required_permissions)?[...new Set(raw.required_permissions.map(String))]:[];
  const core={tool_name,arguments:args,risk_class:String(raw.risk_class||'read-only'),required_permissions,side_effect:String(raw.side_effect||'none'),cost_class:String(raw.cost_class||'none')};
  const evidence={
    ...(clean(raw.runtime)?{runtime:clean(raw.runtime)}:{}),
    ...(normalizeDomain(raw.target_domain)||domainFromArguments(args)?{target_domain:normalizeDomain(raw.target_domain)||domainFromArguments(args)}:{}),
    ...(clean(raw.provider_session_id)?{provider_session_id:clean(raw.provider_session_id)}:{}),
    ...(clean(raw.provider_turn_id)?{provider_turn_id:clean(raw.provider_turn_id)}:{}),
    ...(clean(raw.provider_call_id)?{provider_call_id:clean(raw.provider_call_id)}:{}),
  };
  return {...core,provider:String(raw.provider||'unknown'),...evidence,proposal_hash:hash(stable(core))};
}
function isComputerAction(item){return item.tool_name==='computer.use.approval'||item.tool_name.startsWith('computer.');}
export function createToolGateway({allowedComputerDomains=[]}={}){
  const domainAllowlist=new Set((Array.isArray(allowedComputerDomains)?allowedComputerDomains:[]).map(normalizeDomain).filter(Boolean));
  return Object.freeze({evaluate({proposals=[],context={}}={}){
    const accepted=[],approval_required=[],denied=[],seen=new Set();
    for(const raw of proposals){
      const item=normalize(raw);
      if(!item.tool_name){denied.push({...item,decision_reason:'invalid_tool'});continue;}
      const dedupeKey=stable(proposalCore(item));
      if(seen.has(dedupeKey))continue;
      seen.add(dedupeKey);
      if(item.required_permissions.some(permission=>!has(context,permission))){denied.push({...item,decision_reason:'permission_denied'});continue;}
      if(isComputerAction(item)){
        if(!item.target_domain||!domainAllowlist.has(item.target_domain)){denied.push({...item,decision_reason:'domain_not_allowed'});continue;}
      }
      const sensitive=item.risk_class!=='read-only'||item.side_effect!=='none'||item.cost_class!=='none';
      if(sensitive){approval_required.push({...item,decision_reason:item.cost_class!=='none'?'cost_or_side_effect_approval_required':'side_effect_approval_required'});continue;}
      accepted.push({...item,decision_reason:'policy_allowed'});
    }
    return {accepted,approval_required,denied};
  }});
}
