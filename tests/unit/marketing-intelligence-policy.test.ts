import { describe, expect, it } from 'vitest';
import { evaluateCampaignPolicy } from '../../packages/core/src/marketingIntelligence';

const base = {
  organizationId: 'org-a',
  actorOrganizationId: 'org-a',
  campaignId: 'campaign-a',
  contentSha256: 'sha-1',
  consent: { organizationId: 'org-a', granted: true, version: 2 },
  approval: { organizationId: 'org-a', campaignId: 'campaign-a', contentSha256: 'sha-1', approved: true },
  auditAvailable: true,
  adapterEnabled: false,
  idempotencyKey: 'request-1'
} as const;

describe('Marketing Intelligence 777 — fail-closed policy', () => {
  it('rejects cross-tenant access', () => {
    expect(evaluateCampaignPolicy({ ...base, actorOrganizationId: 'org-b' }).allowed).toBe(false);
  });
  it('rejects revoked or cross-tenant consent', () => {
    expect(evaluateCampaignPolicy({ ...base, consent: { ...base.consent, granted: false } }).allowed).toBe(false);
    expect(evaluateCampaignPolicy({ ...base, consent: { ...base.consent, organizationId: 'org-b' } }).allowed).toBe(false);
  });
  it('rejects missing or stale approval', () => {
    expect(evaluateCampaignPolicy({ ...base, approval: null }).allowed).toBe(false);
    expect(evaluateCampaignPolicy({ ...base, approval: { ...base.approval, contentSha256: 'other' } }).allowed).toBe(false);
  });
  it('rejects missing audit and empty idempotency keys', () => {
    expect(evaluateCampaignPolicy({ ...base, auditAvailable: false }).allowed).toBe(false);
    expect(evaluateCampaignPolicy({ ...base, idempotencyKey: '' }).allowed).toBe(false);
  });
  it('never authorizes execution with a disabled adapter', () => {
    expect(evaluateCampaignPolicy(base).allowed).toBe(false);
  });
  it('requires explicit policy gates even for enabled adapters', () => {
    expect(evaluateCampaignPolicy({ ...base, adapterEnabled: true }).allowed).toBe(true);
  });
});
