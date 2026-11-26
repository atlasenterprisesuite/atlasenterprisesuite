import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBme688Frame, bme688UrbanTwinCandidates } from '../lib/bme688-telemetry.mjs';
const now = new Date('2026-11-26T11:00:00.000Z');
const input = () => ({
  sensor_model: 'BME688', observed_at: now.toISOString(), sequence: 4,
  temperature_c: 23.4, humidity_percent: 52, pressure_hpa: 1013.2, gas_resistance_ohm: 10542
});
const ctx = { entityId: '123e4567-e89b-42d3-a456-426614174000', bindingId: '123e4567-e89b-42d3-a456-426614174001' };
test('accepts bounded raw BME688 channels and produces four untrusted candidates', () => {
  const normalized = normalizeBme688Frame(input(), { now });
  const out = bme688UrbanTwinCandidates(normalized, ctx);
  assert.equal(out.status, 'requires_server_authentication');
  assert.equal(out.observations.length, 4);
  assert.deepEqual(out.observations.map(x => x.metric_key), [
    'bme688.temperature_c', 'bme688.humidity_percent', 'bme688.pressure_hpa', 'bme688.gas_resistance_ohm'
  ]);
  for (const row of out.observations) {
    assert.equal(row.observation_type, 'telemetry');
    assert.equal(row.entity_id, ctx.entityId);
    assert.equal(Object.hasOwn(row, 'provenance'), false);
    assert.equal(Object.hasOwn(row, 'org_id'), false);
    assert.equal(Object.hasOwn(row, 'tenant_id'), false);
  }
});
test('fail closed on attempts to assert tenant, trust, or CO2 from raw sender', () => {
  for (const evil of [{ org_id: ctx.entityId }, { provenance: 'authenticated' }, { co2_ppm: 9999 }, { classifier: 'toxic-gas' }]) {
    assert.throws(() => normalizeBme688Frame({ ...input(), ...evil }, { now }), /bme688_frame_rejected/);
  }
});
test('rejects invalid sensor measurements, NaN, and invalid sequence', () => {
  for (const bad of [
    { temperature_c: 100 }, { humidity_percent: 101 }, { pressure_hpa: 200 },
    { gas_resistance_ohm: 0 }, { temperature_c: Number.NaN }, { pressure_hpa: Infinity },
    { sequence: -1 }, { sensor_model: 'BME680' }, { sequence: 3.5 }
  ]) assert.throws(() => normalizeBme688Frame({ ...input(), ...bad }, { now }), /bme688_frame_rejected/);
});
test('rejects expired, future and malformed timestamps', () => {
  for (const observed_at of [
    '2026-11-26T10:00:00.000Z', '2026-11-26T11:02:00.000Z',
    '2026-11-26T11:00:00.000-01:00', '2026-13-26T11:00:00.000Z'
  ]) assert.throws(() => normalizeBme688Frame({ ...input(), observed_at }, { now }), /bme688_frame_rejected/);
});
test('requires trusted server-provided binding references, not device payload ownership', () => {
  const normalized = normalizeBme688Frame(input(), { now });
  assert.throws(() => bme688UrbanTwinCandidates(normalized, { entityId: ctx.entityId, bindingId: 'fake' }), /required/);
  assert.throws(() => bme688UrbanTwinCandidates(input(), ctx), /normalized_frame_required/);
});
