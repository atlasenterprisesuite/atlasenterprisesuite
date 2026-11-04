/** Proposal-only recovery policy. No I/O or repair execution. */
export type RepairProposal = {
 incidentId:string; tenantId:string; actorTenantId:string; idempotencyKey:string;
 patchSha:string; baseSha:string; authorized:boolean; sandboxVerified:boolean;
 writesProduction:boolean; concurrentClaim:boolean; rollbackVerified:boolean;
};
export type ProposalDecision = { allowed:boolean; reason:string; state:'patch_proposed'|'blocked' };
const sha=/^[a-f0-9]{40}$/i;
export function evaluateProposal(p:RepairProposal):ProposalDecision {
 const blocked=(reason:string):ProposalDecision=>({allowed:false,reason,state:'blocked'});
 if(!p.incidentId?.trim()||!p.idempotencyKey?.trim()||!sha.test(p.patchSha)||!sha.test(p.baseSha))return blocked('invalid_proposal');
 if(!p.tenantId?.trim()||p.tenantId!==p.actorTenantId)return blocked('tenant_mismatch');
 if(!p.authorized)return blocked('unauthorized');
 if(!p.sandboxVerified||p.writesProduction)return blocked('unsafe_environment');
 if(p.concurrentClaim)return blocked('concurrent_claim');
 if(!p.rollbackVerified)return blocked('rollback_unverified');
 if(p.patchSha===p.baseSha)return blocked('no_patch_change');
 return {allowed:true,reason:'proposal_only',state:'patch_proposed'};
}
/** Caller must persist this key atomically with a unique constraint; this pure policy does not guarantee idempotency. */
export function proposalKey(p:RepairProposal):string {
 return [p.tenantId,p.incidentId,p.idempotencyKey].map(encodeURIComponent).join(':');
}
