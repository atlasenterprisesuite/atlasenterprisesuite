export type ExecutorStage =
  | 'DISCOVER' | 'PLAN' | 'IMPLEMENT' | 'TEST' | 'REPAIR' | 'CI'
  | 'SECURITY' | 'REVIEW' | 'READY_FOR_RELEASE' | 'RELEASE'
  | 'VERIFY' | 'COMPLETE' | 'BLOCKED';
export type ExecutorEvidence = { sha: string; testPassed: boolean; ciPassed: boolean; securityPassed: boolean; reviewApproved: boolean; releaseAuthorized: boolean; deployedSha?: string };
export type ExecutorDecision = { stage: ExecutorStage; reason: string; requiresHuman: boolean };
const SHA = /^[0-9a-f]{40}$/;
export function nextExecutorStage(stage: ExecutorStage, evidence: ExecutorEvidence): ExecutorDecision {
  const blocked = (reason: string): ExecutorDecision => ({ stage: 'BLOCKED', reason, requiresHuman: true });
  const next = (stage: ExecutorStage, reason = 'ready'): ExecutorDecision => ({ stage, reason, requiresHuman: false });
  if (!SHA.test(evidence.sha)) return blocked('invalid_exact_sha');
  switch (stage) {
    case 'DISCOVER': return next('PLAN');
    case 'PLAN': return next('IMPLEMENT');
    case 'IMPLEMENT': return next('TEST');
    case 'TEST': return evidence.testPassed ? next('CI') : next('REPAIR', 'tests_failed');
    case 'REPAIR': return next('TEST');
    case 'CI': return evidence.ciPassed ? next('SECURITY') : blocked('ci_not_verified');
    case 'SECURITY': return evidence.securityPassed ? next('REVIEW') : blocked('security_gate_not_verified');
    case 'REVIEW': return evidence.reviewApproved ? next('READY_FOR_RELEASE') : blocked('review_not_approved');
    case 'READY_FOR_RELEASE': return evidence.releaseAuthorized ? next('RELEASE') : blocked('release_not_authorized');
    case 'RELEASE': return next('VERIFY');
    case 'VERIFY': return evidence.deployedSha === evidence.sha && evidence.testPassed && evidence.ciPassed && evidence.securityPassed && evidence.reviewApproved && evidence.releaseAuthorized ? next('COMPLETE', 'exact_sha_verified') : blocked('production_evidence_missing');
    case 'COMPLETE': return next('COMPLETE', 'already_complete');
    case 'BLOCKED': return blocked('explicit_reauthorization_required');
  }
}
