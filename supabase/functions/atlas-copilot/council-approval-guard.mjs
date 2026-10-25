// Fail-closed authorization boundary for future Council side-effect execution.
// The store MUST atomically consume a single-use approval in the database.
const deny=(code)=>Object.assign(new Error(code),{code,status:403});
export async function authorizeCouncilAction({context,proposal,approvalId,store,audit,now=Date.now()}={}){
  if(!context?.organization_id||!context?.user_id||!proposal?.proposal_hash||!approvalId||typeof store?.consumeApproval!=='function'||typeof audit?.record!=='function')throw deny('approval_dependencies_required');
  // A failed audit write is a hard stop, never a best-effort log.
  await audit.record({type:'approval_verification_requested',organization_id:context.organization_id,user_id:context.user_id,approval_id:approvalId,proposal_hash:proposal.proposal_hash});
  // consumeApproval must be one atomic conditional UPDATE ... RETURNING with org,
  // actor, proposal hash, expiry, approved status, and unused state predicates.
  // No read-then-write or privileged cross-tenant lookup is acceptable.
  const approval=await store.consumeApproval({approvalId,organizationId:context.organization_id,userId:context.user_id,proposalHash:proposal.proposal_hash,now});
  if(!approval||approval.organization_id!==context.organization_id||approval.user_id!==context.user_id||approval.proposal_hash!==proposal.proposal_hash||approval.status!=='consumed'||!Number.isFinite(approval.expires_at_ms)||approval.expires_at_ms<=now)throw deny('approval_invalid_or_expired');
  await audit.record({type:'approval_consumed',organization_id:context.organization_id,user_id:context.user_id,approval_id:approvalId,proposal_hash:proposal.proposal_hash});
  return Object.freeze({authorized:true,approval_id:approvalId,proposal_hash:proposal.proposal_hash,organization_id:context.organization_id});
}
