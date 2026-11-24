import { certifyIntegration, type ReadinessInput } from './integrationReadiness777';
/** Untrusted external GitHub payloads must be verified by a server-owned GitHub API client. */
export type GitHubRunEvidence = { id: number; name: string; head_sha: string; status: string; conclusion: string | null; event?: string };
export type GitHubReadinessSnapshot = {
  moduleId: string; sha: string; runs: GitHubRunEvidence[]; p0Open: boolean;
  authorizationRequired: boolean; authorized: boolean;
};
const workflowNames: Record<string, string> = {
  unit: 'ATLAS Build + Production Readiness Gate',
  integration: 'ATLAS Build + Production Readiness Gate',
  typecheck: 'ATLAS Build + Production Readiness Gate',
  build: 'ATLAS Build + Production Readiness Gate',
  security: 'ATLAS GitHub Security Baseline',
  tenantIsolation: 'ATLAS Build + Production Readiness Gate'
};
/** Run success is NOT proof that a specific test ran. Requires separately verified per-step evidence. */
export function evaluateGitHubSnapshot(snapshot: GitHubReadinessSnapshot, verifiedSteps: Readonly<Record<string, { runId: number; sha: string; verified: boolean }>>) {
  const checks: NonNullable<ReadinessInput['checks']> = {};
  for (const [step, workflow] of Object.entries(workflowNames)) {
    const evidence = verifiedSteps[step];
    const run = snapshot.runs.find(row => row.id === evidence?.runId && row.name === workflow && row.head_sha === snapshot.sha &&
      row.status === 'completed' && row.conclusion === 'success');
    if (run && evidence?.verified === true && evidence.sha === snapshot.sha)
      checks[step] = { runId: run.id, sha: snapshot.sha, status: 'completed', conclusion: 'success' };
  }
  return certifyIntegration({ moduleId: snapshot.moduleId, sha: snapshot.sha, checks,
    p0Open: snapshot.p0Open, authorizationRequired: snapshot.authorizationRequired, authorized: snapshot.authorized });
}
