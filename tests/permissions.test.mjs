import test from 'node:test';
import assert from 'node:assert/strict';
import { capabilitiesForRole, hasCapability } from '../src/core/permissions.js';

test('owner receives every Site Review capability', () => {
  const capabilities = capabilitiesForRole('owner');
  assert.deepEqual(new Set(capabilities), new Set([
    'review.read',
    'review.comment',
    'review.assign',
    'review.resolve',
    'review.archive',
    'audit.run',
    'audit.export'
  ]));
});

test('client can review and comment but cannot assign, archive or run audits', () => {
  assert.equal(hasCapability('client', 'review.read'), true);
  assert.equal(hasCapability('client', 'review.comment'), true);
  assert.equal(hasCapability('client', 'review.assign'), false);
  assert.equal(hasCapability('client', 'review.archive'), false);
  assert.equal(hasCapability('client', 'audit.run'), false);
});

test('unknown roles have no capabilities', () => {
  assert.deepEqual(capabilitiesForRole('unknown'), []);
  assert.equal(hasCapability('unknown', 'review.read'), false);
});
