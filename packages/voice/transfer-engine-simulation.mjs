/** ATLAS 777 REVIEW F3. Simulation only: never invokes SIP, GPT-Live, or Telnyx. */
export const TRANSFER_STATES = Object.freeze(['transfer_pending','transfer_unknown','transfer_confirmed','transfer_rejected']);
const e164 = value => typeof value === 'string' && /^\+[1-9]\d{7,14}$/.test(value);
export function createSimulationTransferEngine({allowedDestinations={}, audit=async()=>{}, authorize=async()=>false}={}){
 const requests=new Map();
 const key=(orgId,sessionId,idempotencyKey)=>JSON.stringify([orgId,sessionId,idempotencyKey]);
 const deny=code=>({ok:false,code});
 const copy=record=>({...record});
 async function request(input={}){
  const {orgId,actorId,sessionId,idempotencyKey,destination,sessionActive,tenantActive}=input;
  if(![orgId,actorId,sessionId,idempotencyKey].every(v=>typeof v==='string'&&v.trim()))return deny('identity_or_session_missing');
  if(!/^live_[a-zA-Z0-9_-]+$/.test(sessionId))return deny('invalid_live_session');
  if(sessionActive!==true)return deny('session_not_active');
  if(tenantActive!==true)return deny('organization_inactive');
  if(!e164(destination))return deny('destination_invalid');
  if(!Array.isArray(allowedDestinations[orgId])||!allowedDestinations[orgId].includes(destination))return deny('destination_not_approved');
  const k=key(orgId,sessionId,idempotencyKey), existing=requests.get(k);
  if(existing)return existing.actorId!==actorId||existing.destination!==destination?deny('idempotency_conflict'):existing.issued?{ok:true,deduplicated:true,transfer:copy(existing)}:deny('transfer_processing_or_denied');
  const record={orgId,actorId,sessionId,idempotencyKey,destination,state:'transfer_pending',attempts:0,issued:false};
  requests.set(k,record);
  try{
   if(await authorize({orgId,actorId,sessionId,permission:'communication.telephony.transfer'})!==true){
    record.state='transfer_rejected';await audit({kind:'transfer_denied',orgId,sessionId,reason:'authorization_denied'});return deny('authorization_denied');
   }
   if(await authorize({orgId,actorId,sessionId,permission:'communication.telephony.transfer'})!==true){
    record.state='transfer_rejected';await audit({kind:'transfer_denied',orgId,sessionId,reason:'authorization_revoked'});return deny('authorization_revoked');
   }
   await audit({kind:'transfer_pending',orgId,sessionId});
   record.issued=true;record.attempts=1;
   return {ok:true,deduplicated:false,transfer:copy(record)};
  }catch{record.state='transfer_rejected';return deny('authorization_or_audit_unavailable')}
 }
 async function reconcile({orgId,sessionId,idempotencyKey,outcome,verified=false}={}){
  const record=requests.get(key(orgId,sessionId,idempotencyKey));
  if(!record)return deny('transfer_not_found');
  if(!record.issued)return deny('transfer_not_issued');
  if(!['unknown','confirmed','rejected'].includes(outcome))return deny('invalid_outcome');
  if(verified!==true&&outcome!=='unknown')return deny('provider_evidence_required');
  if(['transfer_confirmed','transfer_rejected'].includes(record.state))return deny('terminal_state');
  const next={unknown:'transfer_unknown',confirmed:'transfer_confirmed',rejected:'transfer_rejected'}[outcome];
  try{await audit({kind:next,orgId,sessionId})}catch{return deny('audit_unavailable')}
  record.state=next;return {ok:true,transfer:copy(record)};
 }
 function read({orgId,sessionId,idempotencyKey}={}){
  const record=requests.get(key(orgId,sessionId,idempotencyKey));
  return record?{ok:true,transfer:copy(record)}:deny('transfer_not_found');
 }
 return Object.freeze({request,reconcile,read,mode:'simulation_only'});
}
