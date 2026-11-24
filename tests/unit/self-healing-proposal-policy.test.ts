import { describe,it,expect } from 'vitest';
import {evaluateProposal,proposalKey,type RepairProposal} from '../../packages/infra-control/recovery/repair-proposal-policy';
const p:RepairProposal={incidentId:'i',tenantId:'a',actorTenantId:'a',idempotencyKey:'once',patchSha:'b'.repeat(40),baseSha:'a'.repeat(40),authorized:true,sandboxVerified:true,writesProduction:false,concurrentClaim:false,rollbackVerified:true};
describe('isolated repair proposals',()=>{
 it('returns proposal, never repaired',()=>expect(evaluateProposal(p)).toEqual({allowed:true,reason:'proposal_only',state:'patch_proposed'}));
 it.each([
 [{actorTenantId:'b'},'tenant_mismatch'],[{authorized:false},'unauthorized'],
 [{sandboxVerified:false},'unsafe_environment'],[{writesProduction:true},'unsafe_environment'],
 [{concurrentClaim:true},'concurrent_claim'],[{rollbackVerified:false},'rollback_unverified'],
 [{patchSha:'a'.repeat(40)},'no_patch_change'],[{patchSha:'fake'},'invalid_proposal'],
 [{idempotencyKey:''},'invalid_proposal']
 ])('fails closed for %j',(change,reason)=>expect(evaluateProposal({...p,...change})).toEqual({allowed:false,reason,state:'blocked'}));
 it('produces stable tenant-scoped idempotency keys',()=>{
 expect(proposalKey(p)).toBe(proposalKey({...p}));
 expect(proposalKey(p)).not.toBe(proposalKey({...p,tenantId:'b'}));
 });
});
