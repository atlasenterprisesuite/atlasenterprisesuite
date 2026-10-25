// Fail-closed boundary: the private database transaction MUST consume the approval
// and insert its durable audit event atomically. No separate post-consumption audit
// write is allowed: it could fail after consumption and strand the approval.
const deny=(code)=>Object.assign(new Error(code),{code,status:403});
export async function authorizeCouncilAction({context,proposal,approvalId,store,now=Date.now()}={}){
  if(!context?.organization_id||!context?.user_id||!proposal?.proposal_hash||!approvalId||typeof store?.consumeApproval!=='function'||!Number.isFinite(now))throw deny('approval_dependencies_required');
  const approval=await store.consumeApproval({approvalId,organizationId:context.organization_id,userId:context.user_id,proposalHash:proposal.proposal_hash,now});
  if(!approval||approval.organization_id!==context.organization_id||approval.user_id!==context.user_id||approval.proposal_hash!==proposal.proposal_hash||approval.status!=='consumed'||!Number.isFinite(approval.expires_at_ms)||approval.expires_at_ms<=now)throw deny('approval_invalid_or_expired');
  // This only authorizes the next stage. External side effects still require
  // their own idempotency key, durable execution state, and retry protection.
  return Object.freeze({authorized:true,approval_id:approvalId,proposal_hash:proposal.proposal_hash,organization_id:context.organization_id});
}
