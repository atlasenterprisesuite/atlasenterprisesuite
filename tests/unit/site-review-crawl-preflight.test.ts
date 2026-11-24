import { describe, expect, it } from 'vitest';
import { assessSiteReviewCrawlPreflight, type SiteReviewCrawlRequest } from '../../packages/execution/src/site-review-crawl-preflight';
import type { BrowserExecutionEnvelope } from '../../packages/execution/src/browser-envelope';

const now = new Date('2026-11-12T18:00:00Z');
const envelope: BrowserExecutionEnvelope = {
  tenantId: 'tenant1', organizationId: 'org1', workflowId: 'flow1', stepId: 'step1',
  allowedDomains: ['atlasenterprisesuite.com'], allowedActions: ['navigate'],
  deniedActions: ['submit'], autonomyLevel: 'guided',
  expiresAt: '2026-11-15T00:00:00Z'
};
const request: SiteReviewCrawlRequest = {
  origin: 'https://atlasenterprisesuite.com/',
  actorId: 'actor1', tenantId: 'tenant1', organizationId: 'org1',
  workflowId: 'flow1', stepId: 'step1',
  authorizationRecordRef: 'authrecord0001',
  authorizationExpiresAt: '2026-11-14T00:00:00Z',
  maxPages: 2, maxResponseBytes: 100000, maxDurationMs: 5000
};
const decision = (update: Partial<SiteReviewCrawlRequest> = {}, env = envelope) =>
  assessSiteReviewCrawlPreflight({ ...request, ...update }, env, now);

describe('site review F3: fail-closed crawl readiness', () => {
  it('does not authorize a network request even when preflight fields are supplied', () => {
    expect(decision()).toEqual({
      mayFetch: false, state: 'blocked',
      reason: 'runtime_authorization_and_socket_bound_egress_missing',
      transport: 'not_configured'
    });
  });
  it('rejects cross-tenant/org/workflow scope', () => {
    for (const x of [{ tenantId: 'other' }, { organizationId: 'other' },
      { workflowId: 'other' }, { stepId: 'other' }]) {
      expect(decision(x).reason).toBe('execution_scope_mismatch');
    }
  });
  it.each([
    'http://atlasenterprisesuite.com/',
    'https://localhost/', 'https://127.0.0.1/',
    'https://169.254.169.254/', 'https://[::1]/',
    'https://sub.atlasenterprisesuite.com/',
    'https://atlasenterprisesuite.com/private',
    'https://atlasenterprisesuite.com/?token=sensitive',
    'https://user:secret@atlasenterprisesuite.com/',
    'https://atlasenterprisesuite.com:8443/',
    'https://metadata.google.internal/',
    'https://atlasenterprisesuite.com/' + String.fromCharCode(10)
  ])('rejects unsafe or non-authorized origin %s', origin => {
    const result = decision({ origin });
    expect(result.mayFetch).toBe(false);
    expect(result.reason).not.toBe('runtime_authorization_and_socket_bound_egress_missing');
  });
  it('requires opaque approval record and valid TTL', () => {
    expect(decision({ authorizationRecordRef: '' }).reason).toBe('external_authorization_record_required');
    expect(decision({ authorizationExpiresAt: '2026-11-11T00:00:00Z' }).reason).toBe('authorization_expired');
  });
  it('rejects excessive/invalid budgets', () => {
    expect(decision({ maxPages: 100 }).reason).toBe('request_budget_invalid');
    expect(decision({ maxDurationMs: Number.NaN }).reason).toBe('request_budget_invalid');
    expect(decision({ maxResponseBytes: 5000000 }).reason).toBe('request_budget_invalid');
  });
  it('honors existing execution envelope allowlist, action and expiration', () => {
    expect(decision({}, { ...envelope, allowedDomains: [] }).reason).toBe('origin_not_allowlisted');
    expect(decision({}, { ...envelope, allowedActions: [] }).reason).toBe('execution_envelope_denied');
    expect(decision({}, { ...envelope, expiresAt: '2026-11-11T00:00:00Z' }).reason).toBe('execution_envelope_denied');
  });
});
