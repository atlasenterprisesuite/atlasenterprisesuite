/**
 * ATLAS 777 — BME688 untrusted frame validator for the existing Local Agent.
 * This module does NOT talk to hardware, authenticate devices or write to a database.
 * Only a privileged, authenticated service can assign tenant/org IDs and provenance.
 */
const ALLOWED = new Set([
  'sensor_model', 'observed_at', 'sequence', 'temperature_c',
  'humidity_percent', 'pressure_hpa', 'gas_resistance_ohm'
]);
const validatedFrames = new WeakSet();
const CHANNELS = Object.freeze([
  ['temperature_c', 'bme688.temperature_c', 'celsius'],
  ['humidity_percent', 'bme688.humidity_percent', 'percent'],
  ['pressure_hpa', 'bme688.pressure_hpa', 'hpa'],
  ['gas_resistance_ohm', 'bme688.gas_resistance_ohm', 'ohm']
]);
function reject(message) { throw new Error('bme688_frame_rejected:' + message); }
function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}
function range(value, minimum, maximum, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) reject(field + '_outside_bounds');
}
function uuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
/** Normalize a single NDJSON-style reading emitted by a locally attached sensor bridge. */
export function normalizeBme688Frame(frame, { now = new Date(), maxAgeMs = 300000, maxFutureMs = 30000 } = {}) {
  if (!plainObject(frame)) reject('object_required');
  for (const key of Object.keys(frame)) if (!ALLOWED.has(key)) reject('unsupported_field:' + key);
  if (frame.sensor_model !== 'BME688') reject('wrong_model');
  if (typeof frame.observed_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(frame.observed_at)) reject('invalid_utc_timestamp');
  const ms = Date.parse(frame.observed_at);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 19) !== frame.observed_at.slice(0, 19)) reject('invalid_timestamp');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || !Number.isFinite(maxAgeMs) || !Number.isFinite(maxFutureMs) || maxAgeMs < 0 || maxFutureMs < 0) reject('invalid_time_policy');
  if (ms < now.getTime() - maxAgeMs || ms > now.getTime() + maxFutureMs) reject('outside_freshness_window');
  if (!Number.isSafeInteger(frame.sequence) || frame.sequence < 0) reject('invalid_sequence');
  range(frame.temperature_c, -40, 85, 'temperature');
  range(frame.humidity_percent, 0, 100, 'humidity');
  range(frame.pressure_hpa, 300, 1100, 'pressure');
  // Only positivity is asserted for gas resistance; a trained classifier is NOT inferred.
  if (typeof frame.gas_resistance_ohm !== 'number' || !Number.isFinite(frame.gas_resistance_ohm) || frame.gas_resistance_ohm <= 0) reject('invalid_gas_resistance');
  const normalized = Object.freeze({
    sensor_model: 'BME688', observed_at: new Date(ms).toISOString(), sequence: frame.sequence,
    temperature_c: frame.temperature_c, humidity_percent: frame.humidity_percent,
    pressure_hpa: frame.pressure_hpa, gas_resistance_ohm: frame.gas_resistance_ohm
  });
  validatedFrames.add(normalized);
  return normalized;
}
/**
 * Builds *non-persistable candidates* matching the existing Urban Twin metric contract.
 * Deliberately omits provenance, tenant_id, org_id and evidence_refs.
 * Server-side identity, binding verification, atomic anti-replay and DB RLS are mandatory.
 */
export function bme688UrbanTwinCandidates(normalizedFrame, { entityId, bindingId } = {}) {
  if (!uuid(entityId) || !uuid(bindingId)) reject('verified_entity_binding_ids_required');
  if (!plainObject(normalizedFrame) || !validatedFrames.has(normalizedFrame) || Object.keys(normalizedFrame).length !== ALLOWED.size ||
      normalizedFrame.sensor_model !== 'BME688' || !Number.isSafeInteger(normalizedFrame.sequence) ||
      !Number.isFinite(Date.parse(normalizedFrame.observed_at))) reject('normalized_frame_required');
  for (const [field] of CHANNELS) if (typeof normalizedFrame[field] !== 'number' || !Number.isFinite(normalizedFrame[field])) reject('normalized_frame_required');
  return Object.freeze({
    status: 'requires_server_authentication',
    observations: CHANNELS.map(([field, metricKey, unit]) => ({
      entity_id: entityId, binding_id: bindingId,
      observation_type: 'telemetry', metric_key: metricKey,
      observed_at: normalizedFrame.observed_at,
      value: { reading: normalizedFrame[field], unit, sensor_model: 'BME688', sequence: normalizedFrame.sequence }
    }))
  });
}
