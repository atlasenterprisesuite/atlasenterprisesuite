import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const record = JSON.parse(readFileSync(new URL('../../data/research/hardware/bosch-bme688.json', import.meta.url), 'utf8'));
const sourceIds = new Set(record.sources.map(source => source.id));

test('BME688 research registry has stable identity and official primary sources', () => {
  assert.equal(record.schema, 'atlas.sensor.technical-reference.v1');
  assert.equal(record.id, 'bosch-sensortec-bme688');
  assert.equal(record.canonicalModule, 'knowledge');
  assert.equal(record.sources.length, sourceIds.size);
  for (const source of record.sources) {
    assert.match(source.url, /^https:\/\//);
    assert.equal(source.verifiedOn, '2026-11-23');
  }
  assert.ok(record.sources.some(s => s.id === 'datasheet' && s.revision === '1.3'));
});

test('all technical claims preserve discoverable source provenance', () => {
  const claims = [
    ...record.channels, ...Object.values(record.specifications),
    record.interpretation, record.safeProofOfConcept
  ];
  for (const claim of claims) {
    assert.ok(claim.sourceIds?.length, 'Every technical claim must reference sources');
    for (const id of claim.sourceIds) assert.ok(sourceIds.has(id), `Missing source reference ${id}`);
  }
  for (const id of record.proposedHardware.referenceSourceIds) assert.ok(sourceIds.has(id));
  for (const id of record.firmwareSoftware.sources) assert.ok(sourceIds.has(id));
});

test('electrical and measurement boundaries match manufacturer reviewed values', () => {
  assert.deepEqual(record.specifications.electrical.vddVolt, [1.71, 3.6]);
  assert.deepEqual(record.specifications.electrical.vddioVolt, [1.2, 3.6]);
  assert.deepEqual(record.specifications.bus.i2cAddressesHex, ['0x76', '0x77']);
  assert.equal(record.specifications.consumption.standardGasScanSeconds, 10.8);
  assert.equal(record.interpretation.directCO2Measurement, false);
  assert.equal(record.interpretation.arbitraryCompoundIdentification, false);
});

test('unconnected and untrained state cannot masquerade as a deployed detector', () => {
  assert.equal(record.runtime.connected, false);
  assert.equal(record.runtime.observationsCount, 0);
  assert.equal(record.runtime.productionVerified, false);
  assert.equal(record.safeProofOfConcept.status, 'experimental_protocol_not_executed');
  assert.ok(record.proposedHardware.constraints.some(x => x.includes('5 V')));
  assert.ok(record.safeProofOfConcept.prohibitions.some(x => x.includes('safety alarm')));
});
