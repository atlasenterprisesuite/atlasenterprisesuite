import { describe, expect, it } from 'vitest';
import {
  approvalMatchesPayload,
  canonicalizeApprovalPayload,
  digestApprovalPayload,
  missingEvidence
} from '../../packages/execution/src';

describe('ATLAS execution approval and evidence contracts', () => {
  it('produces the same digest for equivalent object key order', async () => {
    const a = await digestApprovalPayload({ amount: 100, vendor: 'v-1' });
    const b = await digestApprovalPayload({ vendor: 'v-1', amount: 100 });
    expect(a).toBe(b);
  });

  it('canonicalizes approval keys with locale-independent code-unit order', () => {
    expect(canonicalizeApprovalPayload({ 'ä': 1, z: 2, A: 3, a: 4 }))
      .toBe('{"A":3,"a":4,"z":2,"ä":1}');
  });

  it('fails closed on non-JSON or cyclic approval payloads', () => {
    expect(() => canonicalizeApprovalPayload({ unsafe: undefined }))
      .toThrow('execution_approval_invalid_json');
    expect(() => canonicalizeApprovalPayload({ unsafe: Number.NaN }))
      .toThrow('execution_approval_invalid_json');
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => canonicalizeApprovalPayload(cyclic))
      .toThrow('execution_approval_invalid_json');
  });

  it('rejects stale approval reuse after payload mutation', () => {
    expect(approvalMatchesPayload(
      { payloadVersion: 2, payloadDigest: 'approved-digest', status: 'approved' },
      3,
      'changed-digest'
    )).toBe(false);
  });

  it('accepts only an approved decision bound to the exact version and digest', () => {
    expect(approvalMatchesPayload(
      { payloadVersion: 2, payloadDigest: 'approved-digest', status: 'approved' },
      2,
      'approved-digest'
    )).toBe(true);
  });

  it('returns only missing or unverified evidence kinds', () => {
    expect(missingEvidence(
      ['domain_record', 'validation'],
      [
        { kind: 'domain_record', verified: true },
        { kind: 'validation', verified: false }
      ]
    )).toEqual(['validation']);
  });
});
