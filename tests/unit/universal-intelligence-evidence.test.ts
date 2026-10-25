import { describe, expect, it } from 'vitest';
import { validateVideoEvidence, type VideoEvidence } from '../../packages/creator/universal-intelligence';

const valid: VideoEvidence = {
  organizationId: 'tenant-a', sourceSha256: 'a'.repeat(64), mimeType: 'video/mp4',
  durationSeconds: 4.67,
  findings: [{ id: 'f1', startSecond: 0.5, endSecond: 1.2, state: 'observed',
    confidence: 0.9, description: 'Navigation panel visible', evidencePointer: 'frame:500ms' }]
};
const access = { organizationId: 'tenant-a', permissions: ['creator.read'] };
describe('Issue #908 evidence contract', () => {
  it('accepts well-formed scoped evidence', () => expect(validateVideoEvidence(valid, access)).toEqual([]));
  it('fails closed without access', () => expect(validateVideoEvidence(valid, null)).toContain('unauthorized'));
  it('blocks cross-tenant reads', () => expect(validateVideoEvidence(valid, { ...access, organizationId: 'tenant-b' })).toContain('unauthorized'));
  it('blocks missing permissions', () => expect(validateVideoEvidence(valid, { ...access, permissions: [] })).toContain('unauthorized'));
  it('rejects forged digest', () => expect(validateVideoEvidence({ ...valid, sourceSha256: 'wrong' }, access)).toContain('invalid_sha256'));
  it('rejects out-of-range timecodes', () => expect(validateVideoEvidence({ ...valid, findings: [{ ...valid.findings[0], endSecond: 5 }] }, access)).toContain('invalid_finding'));
  it('rejects invalid confidence', () => expect(validateVideoEvidence({ ...valid, findings: [{ ...valid.findings[0], confidence: 1.2 }] }, access)).toContain('invalid_finding'));
  it('rejects non-finite durations', () => expect(validateVideoEvidence({ ...valid, durationSeconds: Number.NaN }, access)).toContain('invalid_duration'));
});
