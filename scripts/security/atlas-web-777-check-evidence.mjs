// Distinct GitHub evidence types; pure fail-closed verification, no network or writes.
const SHA=/^[a-f0-9]{40}$/;
export function verifyCheckEvidence({sha,workflowRuns,checkRuns,requiredChecks,branchRules}={}) {
 const blockers=[];
 if(!SHA.test(sha??'')) blockers.push('P0_INVALID_HEAD_SHA');
 if(!Array.isArray(workflowRuns)) blockers.push('P0_WORKFLOW_RUNS_UNAVAILABLE');
 if(!Array.isArray(checkRuns)) blockers.push('P0_CHECK_RUNS_UNAVAILABLE');
 if(!Array.isArray(requiredChecks)||requiredChecks.length===0) blockers.push('P0_REQUIRED_CHECKS_UNVERIFIED');
 if(!Array.isArray(branchRules)||!branchRules.some(r=>r.type==='required_status_checks')) blockers.push('P0_ACTIVE_BRANCH_RULES_UNVERIFIED');
 if(Array.isArray(requiredChecks)&&Array.isArray(checkRuns)){
  for(const name of requiredChecks){
   const matches=checkRuns.filter(c=>c.name===name&&c.head_sha===sha);
   if(matches.length!==1||matches[0].status!=='completed'||matches[0].conclusion!=='success')
    blockers.push(`P0_REQUIRED_CHECK_NOT_SUCCESS:${name}`);
  }
  if(checkRuns.some(c=>c.head_sha!==sha)) blockers.push('P0_STALE_CHECK_SHA');
 }
 if(Array.isArray(workflowRuns)&&workflowRuns.some(r=>r.head_sha!==sha)) blockers.push('P0_STALE_WORKFLOW_SHA');
 // Rules configuration is not evidence of actual merge-block enforcement.
 blockers.push('P0_RULESET_NEGATIVE_ENFORCEMENT_UNPROVEN');
 return {ok:false,blockers:[...new Set(blockers)]};
}
