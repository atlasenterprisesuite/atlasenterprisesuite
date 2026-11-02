import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVideoFinding, buildEvidenceRecord } from './evidence.ts';

const source = { sha256: 'a'.repeat(64), durationSeconds: 5.4, organizationId: 'org-a' };
test('valid observation retains timestamp and immutable source reference', () => {
  const record = buildEvidenceRecord(source, { startSecond: 1, endSecond: 2, description: 'Sidebar visible', classification: 'observed', confidence: 0.9 });
  assert.equal(record.sourceSha256, source.sha256);
  assert.equal(record.classification, 'observed');
  assert.equal(record.organizationId, 'org-a');
});
test('rejects timecodes beyond source duration', () => {
  assert.equal(validateVideoFinding(source, { startSecond: 4, endSecond: 6, description: 'x', classification: 'observed', confidence: 0.8 }).ok, false);
});
test('rejects unverified claims disguised as observed evidence', () => {
  assert.equal(validateVideoFinding(source, { startSecond: 0, endSecond: 1, description: 'x', classification: 'verified', confidence: 1 }).ok, false);
});
test('fails closed without organization or digest', () => {
  assert.throws(() => buildEvidenceRecord({ ...source, organizationId: '' }, { startSecond: 0, endSecond: 1, description: 'x', classification: 'inferred', confidence: 0.5 }));
  assert.throws(() => buildEvidenceRecord({ ...source, sha256: '' }, { startSecond: 0, endSecond: 1, description: 'x', classification: 'inferred', confidence: 0.5 }));
});
