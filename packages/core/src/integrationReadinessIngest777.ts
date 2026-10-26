import { evaluateGitHubSnapshot, type GitHubReadinessSnapshot } from './githubReadinessEvidence777';
import { reconcileCertification, type ReadinessLedger } from './certificationAudit777';

export type TrustedGitHubReader = {
  /** Must be implemented with server-owned GitHub credentials; never browser input. */
  fetchRuns: (repository: string, sha: string) => Promise<GitHubReadinessSnapshot['runs']>;
  verifyStepInJobLogs: (repository: string, runId: number, step: string, sha: string) => Promise<boolean>;
};
export type InventoryRecord = {
  repository: string; moduleId: string; sha: string; p0Open: boolean;
  authorizationRequired: boolean; authorized: boolean; organizationId: string;
};
export type InventoryStore = {
  loadForOrganization: (organizationId: string, moduleId: string) => Promise<InventoryRecord | null>;
};
const steps = ['unit', 'integration', 'typecheck', 'build', 'security', 'tenantIsolation'] as const;
const names: Record<string, string> = {
  unit: 'ATLAS Build + Production Readiness Gate',
  integration: 'ATLAS Build + Production Readiness Gate',
  typecheck: 'ATLAS Build + Production Readiness Gate',
  build: 'ATLAS Build + Production Readiness Gate',
  security: 'ATLAS GitHub Security Baseline',
  tenantIsolation: 'ATLAS Build + Production Readiness Gate'
};
const validRepository = /^atlasenterprisesuite\/atlasenterprisesuite$/;
export async function ingestIntegrationReadiness(args: {
  organizationId: string; moduleId: string; inventory: InventoryStore; github: TrustedGitHubReader;
  ledger: ReadinessLedger; now: string;
}) {
  const { organizationId, moduleId, inventory, github, ledger, now } = args;
  if (!organizationId || !moduleId) return { status: 'blocked' as const, reason: 'MISSING_SCOPE' };
  try {
    const record = await inventory.loadForOrganization(organizationId, moduleId);
    if (!record || record.organizationId !== organizationId || record.moduleId !== moduleId ||
      !validRepository.test(record.repository) || !/^[a-f0-9]{40}$/.test(record.sha))
      return { status: 'blocked' as const, reason: 'UNTRUSTED_INVENTORY' };
    const runs = await github.fetchRuns(record.repository, record.sha);
    if (!Array.isArray(runs)) return { status: 'blocked' as const, reason: 'UNVERIFIED_RUNS' };
    const verifiedSteps: Record<string, { runId: number; sha: string; verified: boolean }> = {};
    for (const step of steps) {
      const run = runs.find(row => row.name === names[step] && row.head_sha === record.sha &&
        row.status === 'completed' && row.conclusion === 'success' && Number.isSafeInteger(row.id) && row.id > 0);
      if (!run) continue;
      if (await github.verifyStepInJobLogs(record.repository, run.id, step, record.sha) === true)
        verifiedSteps[step] = { runId: run.id, sha: record.sha, verified: true };
    }
    const evaluated = evaluateGitHubSnapshot({
      moduleId, sha: record.sha, runs, p0Open: record.p0Open,
      authorizationRequired: record.authorizationRequired, authorized: record.authorized
    }, verifiedSteps);
    return reconcileCertification({
      moduleId, sha: record.sha,
      checks: Object.fromEntries(evaluated.verifiedChecks?.map(step => {
        const evidence = verifiedSteps[step];
        return [step, { sha: evidence.sha, runId: evidence.runId, status: 'completed', conclusion: 'success' }];
      }) ?? []),
      p0Open: record.p0Open, authorizationRequired: record.authorizationRequired, authorized: record.authorized
    }, ledger, now);
  } catch {
    return { status: 'blocked' as const, reason: 'TRUSTED_SOURCE_UNAVAILABLE' };
  }
}
