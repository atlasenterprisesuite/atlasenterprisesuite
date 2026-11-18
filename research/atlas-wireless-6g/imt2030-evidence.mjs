/**
 * ATLAS IMT-2030 evidence admission — offline, read-only, fail-closed.
 * This checks a cryptographically signed record against a preconfigured trusted
 * lab key, NOT whether any 6G hardware/network exists or complies with ITU.
 *
 * No mobile-network access, provisioning, RF control or raw personal identifiers.
 */
import { createHash, verify as verifySignature } from 'node:crypto';

const isRecord = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const strictlyPositive = (x) => typeof x === 'number' && Number.isFinite(x) && x > 0;
const validText = (x) => typeof x === 'string' && x.length > 0 && x.length <= 180 && !/[\u0000-\u001f]/.test(x);
const EXACT_KEYS = ['calibrationReference', 'deviceModel', 'firmware', 'labId', 'measurementId', 'measuredAt', 'metrics', 'protocol', 'sampleCount', 'standardsMappingId', 'testPlanId'];
const METRIC_KEYS = ['downlinkMbps', 'latencyP95Ms', 'packetLossPercent'];
function validKeys(obj, keys) {
  return isRecord(obj) && Object.keys(obj).length === keys.length &&
    Object.keys(obj).every((key) => keys.includes(key));
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (isRecord(value)) return '{' + Object.keys(value).sort().map((key) =>
    JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function fingerprintMeasurement(record) {
  if (!validKeys(record, EXACT_KEYS) || !validKeys(record.metrics, METRIC_KEYS)) {
    throw new TypeError('unexpected or missing evidence fields');
  }
  for (const key of EXACT_KEYS.filter((key) => !['metrics', 'sampleCount', 'measuredAt'].includes(key))) {
    if (!validText(record[key])) throw new TypeError('invalid measurement metadata');
  }
  if (!Number.isSafeInteger(record.sampleCount) || record.sampleCount < 1 || record.sampleCount > 10000000) {
    throw new RangeError('invalid sample count');
  }
  if (!strictlyPositive(record.metrics.downlinkMbps) ||
      !strictlyPositive(record.metrics.latencyP95Ms) ||
      typeof record.metrics.packetLossPercent !== 'number' ||
      !Number.isFinite(record.metrics.packetLossPercent) ||
      record.metrics.packetLossPercent < 0 || record.metrics.packetLossPercent > 100) {
    throw new RangeError('invalid metrics');
  }
  const when = Date.parse(record.measuredAt);
  if (typeof record.measuredAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(record.measuredAt) ||
      !Number.isFinite(when) || new Date(when).toISOString() !== new Date(record.measuredAt).toISOString()) {
    throw new TypeError('timestamp must be valid UTC ISO-8601');
  }
  return createHash('sha256').update(canonical(record)).digest('hex');
}
/**
 * Signature verification can authenticate who signed the structured record.
 * It does NOT prove physical calibration, accuracy, regulatory authority, or 6G.
 * Public keys must be provisioned out-of-band through an approved trust registry.
 */
export function inspectLabMeasurement(input, trust = {}) {
  const fail = (reason) => Object.freeze({
    status: 'rejected', reason, provenance: 'unverified_external_claim',
    standardsConformant: false, service6gReady: false, commercialActivationAllowed: false
  });
  if (!isRecord(input) || !isRecord(trust) || !isRecord(input.record)) return fail('invalid_envelope');
  let digest;
  try { digest = fingerprintMeasurement(input.record); }
  catch { return fail('invalid_record'); }
  if (!validText(input.keyId) || !/^[a-zA-Z0-9_-]{8,80}$/.test(input.keyId) ||
      typeof input.signatureBase64 !== 'string' ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(input.signatureBase64) ||
      input.signatureBase64.length > 256 || input.signatureBase64.length < 40) {
    return fail('invalid_signature_envelope');
  }
  const key = Object.hasOwn(trust, input.keyId) ? trust[input.keyId] : null;
  if (!key || typeof key !== 'string' || !key.includes('BEGIN PUBLIC KEY')) return fail('unknown_or_untrusted_signer');
  let verified = false;
  try {
    verified = verifySignature(null, Buffer.from(digest, 'hex'), key, Buffer.from(input.signatureBase64, 'base64'));
  } catch { return fail('signature_verification_error'); }
  if (!verified) return fail('invalid_signature');
  // Signed reports are still only candidate evidence; independent laboratory,
  // equipment, regulatory, and standards review occurs outside this module.
  return Object.freeze({
    status: 'authenticated_pending_independent_review',
    provenance: 'signed_lab_record_unreviewed',
    digestSha256: digest, measurementId: input.record.measurementId,
    signerKeyId: input.keyId,
    standardsConformant: false, service6gReady: false,
    commercialActivationAllowed: false
  });
}
