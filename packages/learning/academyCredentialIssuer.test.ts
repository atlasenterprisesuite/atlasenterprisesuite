import { describe, expect, it, vi } from 'vitest';
import { issueAcademyCredential, type AcademyIssuerStore } from './academyCredentialIssuer';

const request = { enrollmentId: 'e1', courseVersion: 'c1', rubricVersion: 'r1', evidenceDigest: 'sha256:abc', idempotencyKey: 'key1' };
const actor = { userId: 'u1', organizationId: 'org1', capabilities: ['academy:issue'] };
function store(overrides: Partial<AcademyIssuerStore> = {}): AcademyIssuerStore {
  return {
    authenticate: async () => actor,
    transaction: async (fn) => fn({
      lockEnrollment: async () => ({ id: 'e1', userId: 'u1', organizationId: 'org1', courseVersion: 'c1', status: 'active' }),
      getExisting: async () => null,
      getVerifiedAssessment: async () => ({ passed: true, rubricVersion: 'r1', evidenceDigest: 'sha256:abc' }),
      insertCredential: async () => ({ id: 'opaque-1', status: 'active' }),
      insertIdempotency: async () => {},
      appendAudit: async () => {}
    }),
    ...overrides
  };
}
describe('Academy issuer isolated fail-closed boundary', () => {
  it('rejects unauthenticated requests before transaction', async () => {
    const transaction = vi.fn();
    await expect(issueAcademyCredential(request, store({ authenticate: async () => null, transaction }))).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
  it('rejects missing issuer capability', async () => {
    await expect(issueAcademyCredential(request, store({ authenticate: async () => ({ ...actor, capabilities: [] }) }))).rejects.toThrow();
  });
  it('rejects cross-tenant enrollment and revoked enrollment', async () => {
    for (const patch of [{ organizationId: 'other' }, { status: 'revoked' }]) {
      await expect(issueAcademyCredential(request, store({
        transaction: async fn => fn({
          lockEnrollment: async () => ({ id: 'e1', userId: 'u1', organizationId: 'org1', courseVersion: 'c1', status: 'active', ...patch }),
          getExisting: async () => null,
          getVerifiedAssessment: async () => ({ passed: true, rubricVersion: 'r1', evidenceDigest: 'sha256:abc' }),
          insertCredential: async () => { throw new Error('must not insert'); },
          insertIdempotency: async () => {}, appendAudit: async () => {}
        })
      }))).rejects.toThrow();
    }
  });
  it('rejects same idempotency key with different evidence digest', async () => {
    await expect(issueAcademyCredential(request, store({
      transaction: async fn => fn({
        lockEnrollment: async () => ({ id: 'e1', userId: 'u1', organizationId: 'org1', courseVersion: 'c1', status: 'active' }),
        getExisting: async () => ({ evidenceDigest: 'sha256:different', requestFingerprint: JSON.stringify(['org1', 'u1', 'e1', 'c1', 'r1', 'sha256:abc']), credentialId: 'opaque-1', status: 'active' }),
        getVerifiedAssessment: async () => { throw new Error('must not read'); },
        insertCredential: async () => { throw new Error('must not insert'); },
        insertIdempotency: async () => {}, appendAudit: async () => {}
      })
    }))).rejects.toThrow();
  });
  it('returns same credential for identical digest retry without duplicate writes', async () => {
    const insert = vi.fn();
    const result = await issueAcademyCredential(request, store({
      transaction: async fn => fn({
        lockEnrollment: async () => ({ id: 'e1', userId: 'u1', organizationId: 'org1', courseVersion: 'c1', status: 'active' }),
        getExisting: async () => ({ evidenceDigest: 'sha256:abc', requestFingerprint: JSON.stringify(['org1', 'u1', 'e1', 'c1', 'r1', 'sha256:abc']), credentialId: 'opaque-1', status: 'active' }),
        getVerifiedAssessment: async () => null, insertCredential: insert,
        insertIdempotency: async () => {}, appendAudit: async () => {}
      })
    }));
    expect(result.id).toBe('opaque-1');
    expect(insert).not.toHaveBeenCalled();
  });
  it('rejects replay for another enrollment with same evidence and key', async () => {
    await expect(issueAcademyCredential({ ...request, enrollmentId: 'e2' }, store({
      transaction: async fn => fn({
        lockEnrollment: async () => ({ id: 'e2', userId: 'u1', organizationId: 'org1', courseVersion: 'c1', status: 'active' }),
        getExisting: async () => ({ evidenceDigest: 'sha256:abc', requestFingerprint: JSON.stringify(['org1', 'u1', 'e1', 'c1', 'r1', 'sha256:abc']), credentialId: 'opaque-1', status: 'active' }),
        getVerifiedAssessment: async () => null,
        insertCredential: async () => { throw new Error('must not insert'); },
        insertIdempotency: async () => {}, appendAudit: async () => {}
      })
    }))).rejects.toThrow('Idempotency conflict');
  });
  it('preserves revoked status on an identical retry', async () => {
    const result = await issueAcademyCredential(request, store({
      transaction: async fn => fn({
        lockEnrollment: async () => ({ id: 'e1', userId: 'u1', organizationId: 'org1', courseVersion: 'c1', status: 'active' }),
        getExisting: async () => ({ evidenceDigest: 'sha256:abc', requestFingerprint: JSON.stringify(['org1', 'u1', 'e1', 'c1', 'r1', 'sha256:abc']), credentialId: 'opaque-1', status: 'revoked' }),
        getVerifiedAssessment: async () => null,
        insertCredential: async () => { throw new Error('must not insert'); },
        insertIdempotency: async () => {}, appendAudit: async () => {}
      })
    }));
    expect(result.status).toBe('revoked');
  });
  it('requires passing durable evidence and fails closed on audit failure', async () => {
    await expect(issueAcademyCredential(request, store({
      transaction: async fn => fn({
        lockEnrollment: async () => ({ id: 'e1', userId: 'u1', organizationId: 'org1', courseVersion: 'c1', status: 'active' }),
        getExisting: async () => null,
        getVerifiedAssessment: async () => ({ passed: false, rubricVersion: 'r1', evidenceDigest: 'sha256:abc' }),
        insertCredential: async () => { throw new Error('must not insert'); },
        insertIdempotency: async () => {}, appendAudit: async () => {}
      })
    }))).rejects.toThrow();
    await expect(issueAcademyCredential(request, store({
      transaction: async fn => fn({
        lockEnrollment: async () => ({ id: 'e1', userId: 'u1', organizationId: 'org1', courseVersion: 'c1', status: 'active' }),
        getExisting: async () => null,
        getVerifiedAssessment: async () => ({ passed: true, rubricVersion: 'r1', evidenceDigest: 'sha256:abc' }),
        insertCredential: async () => ({ id: 'opaque-1', status: 'active' }),
        insertIdempotency: async () => {}, appendAudit: async () => { throw new Error('audit unavailable'); }
      })
    }))).rejects.toThrow('audit unavailable');
  });
});
