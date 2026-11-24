import { evaluateBrowserAction, type BrowserExecutionEnvelope } from './browser-envelope';

/**
 * No network transport is available in F3. Successful policy preflight is
 * NOT permission to fetch; every result is a blocked decision.
 */
export type SiteReviewCrawlRequest = {
  origin: string;
  actorId: string;
  tenantId: string;
  organizationId: string;
  workflowId: string;
  stepId: string;
  authorizationRecordRef: string;
  authorizationExpiresAt: string;
  maxPages: number;
  maxResponseBytes: number;
  maxDurationMs: number;
};
export type SiteReviewCrawlDecision = {
  mayFetch: false;
  state: 'blocked';
  reason: string;
  transport: 'not_configured';
};
const block = (reason: string): SiteReviewCrawlDecision => ({
  mayFetch: false, state: 'blocked', reason, transport: 'not_configured'
});
const reserved = ['localhost', 'local', 'internal', 'test', 'invalid', 'example', 'onion', 'lan'];

export function assessSiteReviewCrawlPreflight(
  request: SiteReviewCrawlRequest,
  envelope: BrowserExecutionEnvelope,
  now: Date = new Date()
): SiteReviewCrawlDecision {
  if (!request || !envelope || !Number.isFinite(now.getTime())) return block('invalid_request');
  if (![request.actorId, request.tenantId, request.organizationId,
    request.workflowId, request.stepId].every(x => typeof x === 'string' && x.trim().length > 0)) {
    return block('identity_scope_required');
  }
  if (request.tenantId !== envelope.tenantId ||
      request.organizationId !== envelope.organizationId ||
      request.workflowId !== envelope.workflowId ||
      request.stepId !== envelope.stepId) return block('execution_scope_mismatch');

  // Reference is not proof; the backend MUST check the authoritative record.
  if (typeof request.authorizationRecordRef !== 'string' ||
      !/^[A-Za-z0-9_-]{8,96}$/.test(request.authorizationRecordRef)) {
    return block('external_authorization_record_required');
  }
  const expires = new Date(request.authorizationExpiresAt).getTime();
  if (!Number.isFinite(expires) || expires <= now.getTime()) return block('authorization_expired');

  if (!Number.isInteger(request.maxPages) || request.maxPages < 1 || request.maxPages > 25 ||
      !Number.isInteger(request.maxResponseBytes) || request.maxResponseBytes < 1024 ||
      request.maxResponseBytes > 1_048_576 || !Number.isInteger(request.maxDurationMs) ||
      request.maxDurationMs < 1000 || request.maxDurationMs > 30_000) {
    return block('request_budget_invalid');
  }

  if (typeof request.origin !== 'string' || request.origin.length > 2048 ||
      /[\u0000-\u0020\u007f\\]/.test(request.origin)) return block('unsafe_origin');

  let url: URL;
  try { url = new URL(request.origin); } catch { return block('unsafe_origin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.pathname !== '/' || url.search || url.hash) return block('unsafe_origin');

  const host = url.hostname.toLowerCase();
  const labels = host.split('.');
  if (host.length > 253 || labels.length < 2 ||
      labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.startsWith('[') ||
      reserved.some(x => host === x || host.endsWith('.' + x))) return block('unsafe_origin');

  if (!envelope.allowedDomains.some(x => typeof x === 'string' && x.toLowerCase() === host)) {
    return block('origin_not_allowlisted');
  }
  const result = evaluateBrowserAction(envelope, { domain: host, action: 'navigate' }, now,
    { workflowId: request.workflowId, stepId: request.stepId });
  if (!result.allowed) return block('execution_envelope_denied');

  // Server-enforced consent, socket-bound DNS egress, robots and audited
  // execution are not yet implemented: nothing may trigger a request.
  return block('runtime_authorization_and_socket_bound_egress_missing');
}
