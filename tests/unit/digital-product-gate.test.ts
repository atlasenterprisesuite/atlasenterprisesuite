import { describe, expect, it } from 'vitest';
import { evaluateDigitalProductLaunch } from '../../packages/commerce/src/digital-product-gate';

const valid = {
  tenantId: 'tenant-a',
  productTenantId: 'tenant-a',
  productId: 'finance-kit',
  productVersion: 'v1',
  evidence: [
    { id: 'demand-1', kind: 'demand' as const, sourceUrl: 'https://example.org/research', checkedAt: '2026-11-18T10:00:00Z', verified: true },
    { id: 'rights-1', kind: 'rights' as const, sourceUrl: 'https://example.org/rights', checkedAt: '2026-11-18T10:00:00Z', verified: true },
    { id: 'quality-1', kind: 'quality' as const, sourceUrl: 'https://example.org/qa', checkedAt: '2026-11-18T10:00:00Z', verified: true },
    { id: 'approval-1', kind: 'approval' as const, sourceUrl: 'https://example.org/approval', checkedAt: '2026-11-18T10:00:00Z', verified: true }
  ],
  requestedAt: '2026-11-18T12:00:00Z'
};

describe('ATLAS digital product evidence gate (non-executable)', () => {
  it('requires all four verified evidence categories', () => {
    expect(evaluateDigitalProductLaunch(valid)).toMatchObject({ decision: 'REVIEW_REQUIRED', executable: false, blockers: [] });
    expect(evaluateDigitalProductLaunch({ ...valid, evidence: valid.evidence.slice(0, 3) })).toMatchObject({ decision: 'NO_GO', executable: false });
  });
  it('fails closed for cross tenant access', () => {
    expect(evaluateDigitalProductLaunch({ ...valid, productTenantId: 'tenant-b' })).toMatchObject({ decision: 'NO_GO', blockers: ['TENANT_MISMATCH'] });
  });
  it('rejects unverified or future-dated evidence', () => {
    expect(evaluateDigitalProductLaunch({ ...valid, evidence: [{ ...valid.evidence[0], verified: false }, ...valid.evidence.slice(1)] }).decision).toBe('NO_GO');
    expect(evaluateDigitalProductLaunch({ ...valid, evidence: [{ ...valid.evidence[0], checkedAt: '2026-11-19T00:00:00Z' }, ...valid.evidence.slice(1)] }).decision).toBe('NO_GO');
  });
  it('rejects a missing identity and malformed time', () => {
    expect(evaluateDigitalProductLaunch({ ...valid, productId: '' }).decision).toBe('NO_GO');
    expect(evaluateDigitalProductLaunch({ ...valid, requestedAt: 'invalid' }).decision).toBe('NO_GO');
  });
});
