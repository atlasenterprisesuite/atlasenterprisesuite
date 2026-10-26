import { describe, expect, it } from 'vitest';
import { evaluateGitHubSnapshot } from '../../packages/core/src/githubReadinessEvidence777';
const sha = 'a'.repeat(40);
const run = { id: 17, name: 'ATLAS Build + Production Readiness Gate', head_sha: sha, status: 'completed', conclusion: 'success' };
const snapshot = { moduleId: 'atlas-pay', sha, runs: [run], p0Open: true, authorizationRequired: true, authorized: false };
describe('GitHub exact-SHA evidence gate', () => {
  it('does not infer successful unit tests from successful workflow alone', () => {
    expect(evaluateGitHubSnapshot(snapshot, {}).verifiedChecks).toEqual([]);
  });
  it('accepts only separately verified step evidence matching the workflow and SHA', () => {
    expect(evaluateGitHubSnapshot(snapshot, { unit: { runId: 17, sha, verified: true } }).verifiedChecks).toEqual(['unit']);
    expect(evaluateGitHubSnapshot(snapshot, { unit: { runId: 17, sha: 'b'.repeat(40), verified: true } }).verifiedChecks).toEqual([]);
  });
  it('rejects workflow success reported for another commit', () => {
    expect(evaluateGitHubSnapshot({ ...snapshot, runs: [{ ...run, head_sha: 'b'.repeat(40) }] }, { unit: { runId: 17, sha, verified: true } }).verifiedChecks).toEqual([]);
  });
  it('does not bypass open P0', () => {
    expect(evaluateGitHubSnapshot(snapshot, { unit: { runId: 17, sha, verified: true } }).blockers).toContain('P0_OPEN');
  });
});
