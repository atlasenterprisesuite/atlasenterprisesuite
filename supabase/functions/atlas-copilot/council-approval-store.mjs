// Council persistence adapter: no privileged client, no read-then-write.
// Requires a reviewed SECURITY INVOKER RPC that atomically consumes an approval
// and writes the audit event in the same database transaction.
// Until that RPC exists, all authorization attempts fail closed.
const failure=(code)=>Object.assign(new Error(code),{code,status:503});
export function createCouncilApprovalStore({rpc}={}){
  return Object.freeze({
    async consumeApproval({approvalId,organizationId,userId,proposalHash,now}={}){
      if(typeof rpc!=='function')throw failure('approval_persistence_unavailable');
      if(!approvalId||!organizationId||!userId||!proposalHash||!Number.isFinite(now))throw failure('approval_request_invalid');
      let result;
      try{
        result=await rpc('atlas_council_consume_approval',{
          p_approval_id:approvalId,p_org_id:organizationId,p_user_id:userId,
          p_proposal_hash:proposalHash,p_now:new Date(now).toISOString()
        });
      }catch{throw failure('approval_persistence_unavailable');}
      if(result?.error||!result?.data||Array.isArray(result.data)&&result.data.length!==1)throw failure('approval_persistence_unavailable');
      const row=Array.isArray(result.data)?result.data[0]:result.data;
      if(row?.status!=='consumed'||row?.organization_id!==organizationId||row?.user_id!==userId||row?.proposal_hash!==proposalHash)throw failure('approval_invalid_or_expired');
      return row;
    }
  });
}
