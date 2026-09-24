import type { WorkAutonomyLevel } from './work-types';

export type BrowserExecutionEnvelope = {
  workflowId: string;
  stepId: string;
  tenantId: string;
  organizationId: string;
  allowedDomains: string[];
  allowedActions: string[];
  deniedActions: string[];
  autonomyLevel: WorkAutonomyLevel;
  expiresAt: string;
};

export type BrowserActionRequest = {
  domain: string;
  action: string;
};

export type BrowserActionScope = {
  workflowId: string;
  stepId: string;
};

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/\.$/, '');
}

function domainAllowed(domain: string, allowed: string) {
  const normalizedDomain = normalizeHostname(domain);
  const normalizedAllowed = normalizeHostname(allowed);
  return normalizedDomain === normalizedAllowed || normalizedDomain.endsWith(`.${normalizedAllowed}`);
}

export function evaluateBrowserAction(
  envelope: BrowserExecutionEnvelope,
  request: BrowserActionRequest,
  now: string | Date = new Date(),
  scope?: BrowserActionScope
): { allowed: boolean; reason: string } {
  const nowMs = new Date(now).getTime();
  const expiresMs = new Date(envelope.expiresAt).getTime();
  if (!Number.isFinite(expiresMs) || !Number.isFinite(nowMs) || nowMs >= expiresMs) {
    return { allowed: false, reason: 'execution_envelope_expired' };
  }

  if (scope && (scope.workflowId !== envelope.workflowId || scope.stepId !== envelope.stepId)) {
    return { allowed: false, reason: 'execution_scope_mismatch' };
  }

  const action = request.action.trim();
  if (!action) return { allowed: false, reason: 'browser_action_required' };
  if (envelope.deniedActions.includes(action)) return { allowed: false, reason: 'browser_action_explicitly_denied' };
  if (!envelope.allowedActions.includes(action)) return { allowed: false, reason: 'browser_action_not_allowed' };

  const domain = normalizeHostname(request.domain);
  if (!domain || !envelope.allowedDomains.some((allowed) => domainAllowed(domain, allowed))) {
    return { allowed: false, reason: 'browser_domain_not_allowed' };
  }

  return { allowed: true, reason: 'browser_action_allowed' };
}
