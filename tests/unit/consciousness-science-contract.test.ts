import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

// Contract-first tests. The implementation intentionally does not exist yet.
// These tests must fail closed until a verified, isolated implementation is available.
import {
  classifyScientificEvidence,
  validateResearchDataset,
  projectTesseract4D,
  authorizeResearchAction,
  createResearchAuditReceipt,
} from '../../packages/core/src/consciousness-science';

describe('Consciousness Science 777 — fail-closed contracts', () => {
  it('rejects an open dataset without verified provenance, license and digest', () => {
    expect(() => validateResearchDataset({ id: 'ds001787', url: 'https://openneuro.org', license: null, sha256: null })).toThrow();
  });
  it('never upgrades a spiritual claim into measured scientific evidence', () => {
    expect(classifyScientificEvidence({ claim: 'geometry opens portals', sources: [], type: 'spiritual' }).status).not.toBe('verified');
  });
  it('generates deterministic 4D projections with finite coordinates', () => {
    const a = projectTesseract4D({ angle: 0, distance: 5 });
    expect(a.vertices).toHaveLength(16);
    expect(a.edges).toHaveLength(32);
    expect(a.vertices.every((v: number[]) => v.length === 3 && v.every(Number.isFinite))).toBe(true);
    expect(projectTesseract4D({ angle: 0, distance: 5 })).toEqual(a);
  });
  it('rejects cross-tenant, revoked and unauthorized research writes', () => {
    for (const principal of [
      { tenantId: 'other', role: 'admin', revoked: false },
      { tenantId: 'tenant-a', role: 'viewer', revoked: false },
      { tenantId: 'tenant-a', role: 'admin', revoked: true },
    ]) expect(() => authorizeResearchAction(principal, { tenantId: 'tenant-a', action: 'write' })).toThrow();
  });
  it('binds audit receipts to an exact SHA-256 digest without secrets', () => {
    const payload = 'reproducible-fixture-v1';
    const sha256 = createHash('sha256').update(payload).digest('hex');
    const receipt = createResearchAuditReceipt({ tenantId: 'tenant-a', payload, sha256, seed: 777 });
    expect(receipt.sha256).toBe(sha256);
    expect(JSON.stringify(receipt)).not.toMatch(/authorization|bearer|secret|api_key/i);
    expect(() => createResearchAuditReceipt({ tenantId: 'tenant-a', payload, sha256: '0'.repeat(64), seed: 777 })).toThrow();
  });
});
