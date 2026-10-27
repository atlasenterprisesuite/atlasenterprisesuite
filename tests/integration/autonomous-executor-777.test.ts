import { describe, expect, it } from 'vitest';
import { nextExecutorStage, type ExecutorEvidence } from '../../packages/execution/src/autonomous-executor-777';
const sha = 'a'.repeat(40);
const evidence: ExecutorEvidence = { sha, testPassed: true, ciPassed: true, securityPassed: true, reviewApproved: true, releaseAuthorized: true, deployedSha: sha };
describe('Autonomous Executor 777 fail-closed transition core', () => {
  it('moves through authorized verified stages', () => {
    expect(nextExecutorStage('TEST', evidence).stage).toBe('CI');
    expect(nextExecutorStage('CI', evidence).stage).toBe('SECURITY');
    expect(nextExecutorStage('SECURITY', evidence).stage).toBe('REVIEW');
    expect(nextExecutorStage('VERIFY', evidence).stage).toBe('COMPLETE');
  });
  it('repairs failed tests but never bypasses security', () => {
    expect(nextExecutorStage('TEST', { ...evidence, testPassed: false }).stage).toBe('REPAIR');
    expect(nextExecutorStage('SECURITY', { ...evidence, securityPassed: false }).stage).toBe('BLOCKED');
  });
  it('requires separate review and release authorization', () => {
    expect(nextExecutorStage('REVIEW', { ...evidence, reviewApproved: false }).stage).toBe('BLOCKED');
    expect(nextExecutorStage('READY_FOR_RELEASE', { ...evidence, releaseAuthorized: false }).stage).toBe('BLOCKED');
  });
  it('rejects mismatched deployed SHA and malformed source SHA', () => {
    expect(nextExecutorStage('VERIFY', { ...evidence, deployedSha: 'b'.repeat(40) }).stage).toBe('BLOCKED');
    expect(nextExecutorStage('DISCOVER', { ...evidence, sha: 'main' }).stage).toBe('BLOCKED');
  });
  it('cannot resume a blocked task without explicit reauthorization', () => {
    expect(nextExecutorStage('BLOCKED', evidence).requiresHuman).toBe(true);
  });
});
