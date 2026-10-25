import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorizeCouncilAction} from '../../supabase/functions/atlas-copilot/council-approval-guard.mjs';
const ctx={organization_id:'org-a',user_id:'user-a'};
const proposal={proposal_hash:'hash-a'};
const approval={organization_id:'org-a',user_id:'user-a',proposal_hash:'hash-a',status:'consumed',expires_at_ms:2000};
function harness(overrides={}){
 const events=[];
 const audit={record:async e=>{events.push(e);}};
 const store={consumeApproval:async()=>approval};
 return {args:{context:ctx,proposal,approvalId:'approval-a',store,audit,now:1000,...overrides},events};
}
test('accepts only matching atomically consumed unexpired approval',async()=>{
 const {args,events}=harness();
 const result=await authorizeCouncilAction(args);
 assert.equal(result.authorized,true);
 assert.deepEqual(events,[]); // durable audit belongs to the atomic database transaction
});
for(const [name,record] of [['other tenant',{...approval,organization_id:'org-b'}],['other actor',{...approval,user_id:'user-b'}],['other action',{...approval,proposal_hash:'hash-b'}],['not consumed',{...approval,status:'approved'}],['expired',{...approval,expires_at_ms:1000}],['missing',null]]){
 test('denies '+name,async()=>{
  const {args}=harness({store:{consumeApproval:async()=>record}});
  await assert.rejects(authorizeCouncilAction(args),{code:'approval_invalid_or_expired'});
 });
}
test('denies absent persistence dependency',async()=>{const {args}=harness({store:null});await assert.rejects(authorizeCouncilAction(args),{code:'approval_dependencies_required'});});
test('does not call a separate audit dependency after atomic consumption',async()=>{
 let writes=0;
 const {args}=harness({audit:{record:async()=>{writes++;throw Error('separate_audit_must_not_run');}}});
 assert.equal((await authorizeCouncilAction(args)).authorized,true);
 assert.equal(writes,0);
});
test('propagates database failure without granting authorization',async()=>{
 const {args}=harness({store:{consumeApproval:async()=>{throw Error('db_offline');}}});
 await assert.rejects(authorizeCouncilAction(args),/db_offline/);
});
