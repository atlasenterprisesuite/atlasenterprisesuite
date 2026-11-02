// ATLAS UIN: deterministic, fail-closed connector execution gate.
// No external provider may bypass the existing ATLAS authorization layer.
export function evaluateUinConnectorRequest(input) {
  const reasons = [];
  if (!input || typeof input !== 'object') return { allowed: false, reasons: ['invalid_request'] };
  if (!input.tenantId || !input.actorId) reasons.push('missing_identity_scope');
  if (!input.authorized) reasons.push('authorization_required');
  if (!input.providerVerified) reasons.push('provider_not_verified');
  if (!input.credentialsConfigured) reasons.push('credentials_missing');
  if (input.connectionState !== 'connected') reasons.push('connection_not_connected');
  const required = [...new Set(input.requiredCapabilities ?? [])];
  const granted = new Set(input.grantedCapabilities ?? []);
  if (required.some(capability => !granted.has(capability))) reasons.push('capability_missing');
  if (input.operation !== 'read' && input.operation !== 'write') reasons.push('invalid_operation');
  if (input.operation === 'write' && !input.approvedMutation) reasons.push('mutation_approval_required');
  if (input.estimatedCost > 0 && !input.approvedCost) reasons.push('cost_approval_required');
  return { allowed: reasons.length === 0, reasons };
}
