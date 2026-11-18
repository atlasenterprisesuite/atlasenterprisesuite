import test from 'node:test';
import assert from 'node:assert/strict';
import { runImt2030Study, planSecondLine, STUDY_MAX_SCENARIOS } from './imt2030-lab.mjs';

const scenario = { offeredMbps: 150, capacityMbps: 100, baseLatencyMs: 10 };

test('offline IMT-2030 research suite is deterministic, non-observed and never activates service', () => {
  const first = runImt2030Study({ scenarios: [scenario, { offeredMbps: 0, capacityMbps: 100, baseLatencyMs: 10 }] });
  const second = runImt2030Study({ scenarios: [scenario, { offeredMbps: 0, capacityMbps: 100, baseLatencyMs: 10 }] });
  assert.deepEqual(first, second);
  assert.equal(first.aggregate.scenarioCount, 2);
  assert.equal(first.aggregate.meanDeliveredMbps, 50);
  assert.equal(first.complianceStatus, 'not_assessed');
  assert.equal(first.evidenceClass, 'simulation_not_measurement');
  assert.equal(first.observed, false);
  assert.equal(first.radioTransmissions, false);
  assert.equal(first.subscriberActivationAllowed, false);
  assert.equal(first.commercial6gAvailable, false);
  assert.equal(first.scenarios[0].deliveredMbps, 100);
  assert.equal(first.scenarios[1].estimatedLossPercent, 0);
  assert.equal(Object.isFrozen(first.aggregate), true);
});

test('study bounds and input validation fail closed', () => {
  for (const bad of [null, {}, { scenarios: [] }, { scenarios: Array(STUDY_MAX_SCENARIOS + 1).fill(scenario) },
    { scenarios: [null] }, { scenarios: [{ ...scenario, carrierToken: 'secret' }] },
    { scenarios: [{ ...scenario, capacityMbps: -1 }] }]) {
    assert.throws(() => runImt2030Study(bad));
  }
});

test('second number remains unassigned until licensed carrier provisions it', () => {
  const state = planSecondLine();
  assert.equal(state.intent, 'new_number');
  assert.equal(state.numberAssigned, false);
  assert.equal(state.esimIssued, false);
  assert.equal(state.activationAllowed, false);
  assert.equal(state.accountChargeAuthorized, false);
  assert.equal(state.mobileDataTechnology, 'carrier_4g_or_5g_only');
  for (const request of [{ activate: true }, { provision: true }, { payment: true }, null, []]) {
    assert.throws(() => planSecondLine(request));
  }
});
