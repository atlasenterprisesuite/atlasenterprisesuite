import { describe, expect, it } from 'vitest';
import { evaluateUnifiedIntegrationEvidence777 } from '../../packages/core/src/unifiedIntegrationEvidence777';

const SHA = 'a'.repeat(40);
const base = () => ({
  organizationId: 'org-a', tenantId: 'tenant-a', actorOrganizationId: 'org-a',
  actorTenantId: 'tenant-a', actorRole: 'admin', membershipActive: true,
  targetSha: SHA, observedSha: SHA, runtimeLeaseValid: true,
  certificationVerified: true, repairVerified: true,
  auditReceiptId: 'receipt-1', auditReceiptOrganizationId: 'org-a',
  auditReceiptTenantId: 'tenant-a', auditReceiptSha: SHA,
  idempotencyKey: 'operation-1', receiptAlreadyConsumed: false,
  concurrentClaimCount: 1
});
describe('unified integration evidence 777 fail-closed TDD', () => {
  it('rejects cross-tenant and cross-organization evidence', () => {
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), actorTenantId: 'tenant-b' }).allowed).toBe(false);
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), actorOrganizationId: 'org-b' }).allowed).toBe(false);
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), auditReceiptTenantId: 'tenant-b' }).allowed).toBe(false);
  });
  it('rejects revoked membership and insufficient RBAC', () => {
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), membershipActive: false }).allowed).toBe(false);
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), actorRole: 'viewer' }).allowed).toBe(false);
  });
  it('rejects mismatched or malformed exact SHA', () => {
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), observedSha: 'b'.repeat(40) }).allowed).toBe(false);
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), targetSha: 'a'.repeat(7) }).allowed).toBe(false);
  });
  it('rejects missing or mismatched audit receipt and replay', () => {
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), auditReceiptId: '' }).allowed).toBe(false);
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), auditReceiptSha: 'b'.repeat(40) }).allowed).toBe(false);
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), receiptAlreadyConsumed: true }).allowed).toBe(false);
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), idempotencyKey: '' }).allowed).toBe(false);
  });
  it('rejects concurrent claims and expired lease', () => {
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), concurrentClaimCount: 2 }).allowed).toBe(false);
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), runtimeLeaseValid: false }).allowed).toBe(false);
  });
  it('rejects unverified certification or repair', () => {
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), certificationVerified: false }).allowed).toBe(false);
    expect(evaluateUnifiedIntegrationEvidence777({ ...base(), repairVerified: false }).allowed).toBe(false);
  });
  it('accepts only a consistent evidence snapshot; never authorizes execution itself', () => {
    expect(evaluateUnifiedIntegrationEvidence777(base())).toEqual({ allowed: true, reason: 'evidence_consistent' });
  });
});
