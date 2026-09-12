import test from 'node:test';
import assert from 'node:assert/strict';
import { capabilitiesForRole, hasCapability } from '../src/core/permissions.js';

const automationCapabilities = [
  'automation.read','automation.create','automation.update','automation.delete','automation.execute','automation.manage','automation.audit'
];

test('owner receives every Site Review and automation capability', () => {
  assert.deepEqual(new Set(capabilitiesForRole('owner')), new Set([
    'review.read','review.comment','review.assign','review.resolve','review.archive','audit.run','audit.export',
    ...automationCapabilities
  ]));
});

test('developer receives approved automation capabilities but cannot manage or delete', () => {
  for (const capability of ['automation.read','automation.create','automation.update','automation.execute','automation.audit']) {
    assert.equal(hasCapability('developer', capability), true);
  }
  assert.equal(hasCapability('developer', 'automation.manage'), false);
  assert.equal(hasCapability('developer', 'automation.delete'), false);
});

test('designer reviewer and client can read automations but cannot mutate or execute them', () => {
  for (const role of ['designer','reviewer','client']) {
    assert.equal(hasCapability(role, 'automation.read'), true);
    assert.equal(hasCapability(role, 'automation.create'), false);
    assert.equal(hasCapability(role, 'automation.execute'), false);
  }
});

test('client retains Site Review access without privileged audit actions', () => {
  assert.equal(hasCapability('client', 'review.read'), true);
  assert.equal(hasCapability('client', 'review.comment'), true);
  assert.equal(hasCapability('client', 'review.assign'), false);
  assert.equal(hasCapability('client', 'review.archive'), false);
  assert.equal(hasCapability('client', 'audit.run'), false);
});

test('unknown roles have no capabilities', () => {
  assert.deepEqual(capabilitiesForRole('unknown'), []);
  assert.equal(hasCapability('unknown', 'review.read'), false);
  assert.equal(hasCapability('unknown', 'automation.read'), false);
});
