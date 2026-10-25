import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCouncilApprovalStore} from '../../supabase/functions/atlas-copilot/council-approval-store.mjs';
const args={approvalId:'a',organizationId:'org-a',userId:'user-a',proposalHash:'hash-a',now:1000};
const row={status:'consumed',organization_id:'org-a',user_id:'user-a',proposal_hash:'hash-a',expires_at_ms:2000};
test('fails closed without persistence RPC',async()=>{await assert.rejects(createCouncilApprovalStore().consumeApproval(args),{code:'approval_persistence_unavailable'});});
test('passes exact tenant actor action and timestamp to atomic RPC',async()=>{
 let call;
 const store=createCouncilApprovalStore({rpc:async(...v)=>{call=v;return {data:row};}});
 assert.deepEqual(await store.consumeApproval(args),row);
 assert.equal(call[0],'atlas_council_consume_approval');
 assert.equal(call[1].p_org_id,'org-a');
 assert.equal(call[1].p_proposal_hash,'hash-a');
});
for(const [name,value] of [['cross tenant',{...row,organization_id:'org-b'}],['cross user',{...row,user_id:'user-b'}],['wrong hash',{...row,proposal_hash:'hash-b'}],['not consumed',{...row,status:'approved'}]]){
 test('denies '+name,async()=>{await assert.rejects(createCouncilApprovalStore({rpc:async()=>({data:value})}).consumeApproval(args),{code:'approval_invalid_or_expired'});});
}
test('rejects persistence errors',async()=>{await assert.rejects(createCouncilApprovalStore({rpc:async()=>{throw Error('db down');}}).consumeApproval(args),{code:'approval_persistence_unavailable'});});
test('rejects empty result',async()=>{await assert.rejects(createCouncilApprovalStore({rpc:async()=>({data:null})}).consumeApproval(args),{code:'approval_persistence_unavailable'});});
