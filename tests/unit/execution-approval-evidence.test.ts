import { describe, expect, it } from 'vitest';
import {
  approvalMatchesPayload,
  digestApprovalPayload,
  missingEvidence
} from '../../packages/execution/src';

describe('ATLAS execution approval and evidence contracts', () => {
  it('produces the same digest for equivalent object key order', async () => {
    const a = await digestApprovalPayload({ amount: 100, vendor: 'v-1' });
    const b = await digestApprovalPayload({ vendor: 'v-1', amount: 100 });
    expect(a).toBe(b);
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
