import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCarrierIntegration, CARRIER_GATES } from './carrier-preflight.mjs';

test('missing carrier contracts cannot enable anything', () => {
  const state = assessCarrierIntegration();
  assert.equal(state.checks.length, 7);
  assert.equal(state.metadataComplete, false);
  assert.equal(state.providerApiAccessAllowed, false);
  assert.equal(state.simProvisioningAllowed, false);
  assert.equal(state.numberReservationAllowed, false);
  assert.equal(state.chargesAllowed, false);
  assert.equal(state.subscriberActivationAllowed, false);
});
test('even complete claimant metadata is not independent proof of operator permission', () => {
  const evidence = Object.fromEntries(CARRIER_GATES.map(stage => [stage, {
    reviewed: true, reference: 'https://example.test/placeholder-not-real', reviewerId: 'demo_reviewer'
  }]));
  const state = assessCarrierIntegration({ evidence });
  assert.equal(state.metadataComplete, true);
  assert.equal(state.operatorContractAuthenticated, false);
  assert.equal(state.providerApiAccessAllowed, false);
  assert.equal(state.subscriberActivationAllowed, false);
});
test('missing authorization fields, invalid URLs and malformed inputs do not pass', () => {
  for (const value of [
    { evidence: { carrier_agreement: { reviewed: true, reference: 'javascript:alert(1)', reviewerId: 'ok' } } },
    { evidence: { carrier_agreement: { reviewed: true, reference: 'https://test.invalid/x', reviewerId: '!' } } },
    { evidence: 'verified' },
    {}
  ]) {
    const state = assessCarrierIntegration(value);
    assert.equal(state.metadataComplete, false);
    assert.equal(state.providerApiAccessAllowed, false);
  }
  for (const invalid of [null, [], 'hello']) assert.throws(() => assessCarrierIntegration(invalid));
});
