/** ATLAS 777 integration readiness. Pure evaluator; unverified inputs never certify. */
export const readinessStates = Object.freeze({
  DEVELOPMENT: 'development',
  VALIDATION: 'validation',
  APPROVAL: 'ready_for_approval',
  OPERATIONAL: 'operational_confirmed'
});
const required = ['unit', 'integration', 'typecheck', 'build', 'security', 'tenantIsolation'];
const validSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
function verified(check, sha) {
  return check?.conclusion === 'success' && check?.status === 'completed' &&
    check?.sha === sha && typeof check?.runId === 'number' && Number.isSafeInteger(check.runId) && check.runId > 0;
}
export function certifyIntegration(input) {
  const moduleId = input?.moduleId;
  const sha = input?.sha;
  if (typeof moduleId !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(moduleId) || !validSha(sha))
    return { state: readinessStates.DEVELOPMENT, certified: false, blockers: ['INVALID_IDENTITY'], moduleId: null, sha: null };
  const checks = input?.checks ?? {};
  const blockers = required.filter(name => !verified(checks[name], sha)).map(name => 'UNVERIFIED_' + name.toUpperCase());
  if (input?.p0Open !== false) blockers.push('P0_OPEN');
  if (input?.authorizationRequired === true && input?.authorized !== true) blockers.push('AUTHORIZATION_REQUIRED');
  const gatesComplete = blockers.length === 0;
  const deployment = input?.deployment;
  const productionVerified = gatesComplete && input?.authorized === true &&
    deployment?.environment === 'production' && deployment?.sha === sha &&
    deployment?.status === 'success' && deployment?.postDeployVerified === true &&
    typeof deployment?.evidenceId === 'string' && deployment.evidenceId.length > 0;
  const state = productionVerified ? readinessStates.OPERATIONAL :
    gatesComplete ? readinessStates.APPROVAL :
    required.some(name => verified(checks[name], sha)) ? readinessStates.VALIDATION : readinessStates.DEVELOPMENT;
  return { moduleId, sha, state, certified: productionVerified, blockers, verifiedChecks: required.filter(name => verified(checks[name], sha)) };
}
export function readinessNotification(previous, current) {
  if (!current?.moduleId || !current?.sha) return null;
  const milestone = current.state !== previous?.state && ['ready_for_approval', 'operational_confirmed'].includes(current.state);
  const humanBlocker = current.blockers?.includes('AUTHORIZATION_REQUIRED') && !previous?.blockers?.includes('AUTHORIZATION_REQUIRED');
  return milestone || humanBlocker ? { moduleId: current.moduleId, sha: current.sha, state: current.state, blockers: current.blockers } : null;
}
