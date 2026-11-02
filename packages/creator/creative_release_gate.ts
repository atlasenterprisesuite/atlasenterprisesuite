export type CreativeReleaseEvidence = {
  commitSha: string;
  ciSha: string;
  ciPassed: boolean;
  unitPassed: boolean;
  integrationPassed: boolean;
  buildPassed: boolean;
  tenantIsolationPassed: boolean;
  renderRuntimeHealthy: boolean;
  renderE2ePassed: boolean;
  auditEvidencePresent: boolean;
  humanRenderApproved: boolean;
};
export type CreativeReleaseDecision = { ready: boolean; blockers: string[] };
const SHA = /^[a-f0-9]{40}$/;
export function evaluateCreativeRelease(e: CreativeReleaseEvidence): CreativeReleaseDecision {
  const blockers: string[] = [];
  if (!SHA.test(e.commitSha) || e.ciSha !== e.commitSha) blockers.push('exact-sha');
  const gates: Array<[keyof CreativeReleaseEvidence, string]> = [
    ['ciPassed', 'ci'], ['unitPassed', 'unit'], ['integrationPassed', 'integration'],
    ['buildPassed', 'build'], ['tenantIsolationPassed', 'tenant-isolation'],
    ['renderRuntimeHealthy', 'native-runtime'], ['renderE2ePassed', 'render-e2e'],
    ['auditEvidencePresent', 'audit'], ['humanRenderApproved', 'render-approval'],
  ];
  for (const [field, label] of gates) if (e[field] !== true) blockers.push(label);
  return { ready: blockers.length === 0, blockers };
}
