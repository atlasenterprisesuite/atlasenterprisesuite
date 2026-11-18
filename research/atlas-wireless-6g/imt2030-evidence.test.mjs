import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { fingerprintMeasurement, inspectLabMeasurement } from './imt2030-evidence.mjs';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const pem = publicKey.export({ type: 'spki', format: 'pem' });
const record = {
  calibrationReference: 'CAL-APPROVAL-PENDING', deviceModel: 'LAB-DEVICE-UNVERIFIED',
  firmware: '0.0.0-unverified', labId: 'TEST-LAB-NOT-REAL',
  measurementId: 'DEMO-ONLY-001', measuredAt: '2026-10-01T00:00:00.000Z',
  metrics: { downlinkMbps: 100, latencyP95Ms: 10, packetLossPercent: 0.5 },
  protocol: 'offline-fixture-only', sampleCount: 20,
  standardsMappingId: 'RESEARCH-NO-CLAUSE', testPlanId: 'NON-CERTIFICATION-DEMO'
};
const keyId = 'demo_offline_key';
const signRecord = (value) => sign(null, Buffer.from(fingerprintMeasurement(value), 'hex'), privateKey).toString('base64');
const envelope = { record, keyId, signatureBase64: signRecord(record) };

test('exact record hashing is deterministic', () => {
  assert.equal(fingerprintMeasurement(record), fingerprintMeasurement({ ...record, metrics: { packetLossPercent: 0.5, latencyP95Ms: 10, downlinkMbps: 100 } }));
  assert.match(fingerprintMeasurement(record), /^[a-f0-9]{64}$/);
});
test('signed evidence is authenticated yet always pending independent review and never activates 6G', () => {
  const outcome = inspectLabMeasurement(envelope, { [keyId]: pem });
  assert.equal(outcome.status, 'authenticated_pending_independent_review');
  assert.equal(outcome.provenance, 'signed_lab_record_unreviewed');
  assert.equal(outcome.standardsConformant, false);
  assert.equal(outcome.service6gReady, false);
  assert.equal(outcome.commercialActivationAllowed, false);
  assert.equal(outcome.digestSha256, fingerprintMeasurement(record));
});
test('unknown signer, tampering and absent trust reject', () => {
  for (const candidate of [
    [envelope, {}], [envelope, { [keyId]: 'untrusted' }],
    [{ ...envelope, record: { ...record, sampleCount: 200 } }, { [keyId]: pem }],
    [{ ...envelope, signatureBase64: signRecord(record).slice(0, -4) + 'AAAA' }, { [keyId]: pem }],
    [null, { [keyId]: pem }], [{ ...envelope, keyId: '__proto__' }, { [keyId]: pem }]
  ]) {
    assert.equal(inspectLabMeasurement(...candidate).status, 'rejected');
  }
});
test('invalid fields, oversized samples, fake ISO, ambiguous metrics fail closed', () => {
  for (const changed of [
    { ...record, subscriberPhone: '+15551234567' },
    { ...record, metrics: { ...record.metrics, downlinkMbps: -1 } },
    { ...record, metrics: { ...record.metrics, packetLossPercent: 101 } },
    { ...record, sampleCount: 10000001 },
    { ...record, measuredAt: '2026-02-30T00:00:00.000Z' },
    { ...record, calibrationReference: '' }
  ]) {
    assert.throws(() => fingerprintMeasurement(changed));
    assert.equal(inspectLabMeasurement({ ...envelope, record: changed }, { [keyId]: pem }).status, 'rejected');
  }
});
