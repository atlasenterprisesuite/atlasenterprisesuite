/** Genesis Covenant 777 v0.1: pure, fail-closed preflight. No external side effects. */
const protectedActions = new Set(['sensor_access','personal_data','production_write','deploy','merge','spend','physical_actuator','self_modify','safety_control_change']);
const prohibitedActions = new Set(['disable_safeguards','disable_audit','disable_emergency_stop','autonomous_violence']);
const safeId = s => typeof s === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(s);
export function evaluateGenesisCovenant(request, context) {
  const deny = reason => Object.freeze({ allowed: false, reason });
  if (!request || !context || !safeId(request.organizationId) || !safeId(context.organizationId) || request.organizationId !== context.organizationId) return deny('TENANT_INVALID');
  if (!safeId(request.action) || !safeId(request.actorId) || !safeId(context.actorId) || request.actorId !== context.actorId) return deny('IDENTITY_INVALID');
  if (context.emergencyStop !== false) return deny('EMERGENCY_STOP_OR_UNKNOWN');
  if (context.auditAvailable !== true || context.policyAvailable !== true) return deny('GOVERNANCE_UNAVAILABLE');
  if (prohibitedActions.has(request.action)) return deny('PROHIBITED_ACTION');
  if (request.claimsHuman === true || request.claimsDivineAuthority === true) return deny('MISREPRESENTATION');
  if (request.action !== 'verify' && request.action !== 'audit' && request.action !== 'test' && request.action !== 'diagnose') {
    if (!protectedActions.has(request.action)) return deny('UNKNOWN_ACTION');
    if (context.humanApproval?.verified !== true || context.humanApproval.organizationId !== request.organizationId || context.humanApproval.action !== request.action || context.humanApproval.revoked === true) return deny('HUMAN_APPROVAL_REQUIRED');
    if (request.action === 'sensor_access' || request.action === 'personal_data') {
      const c = context.consent;
      if (!c || c.revoked !== false || c.organizationId !== request.organizationId || c.actorId !== request.actorId || c.purpose !== request.purpose || !safeId(request.purpose)) return deny('CONSENT_REQUIRED');
    }
  }
  return Object.freeze({ allowed: true, reason: 'PREFLIGHT_ONLY_NOT_EXECUTION_AUTHORIZATION' });
}
