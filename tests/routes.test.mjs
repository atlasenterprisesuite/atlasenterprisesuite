import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRoute } from '../src/core/routes.js';

test('resolves root and Site Review routes to the Site Review module', () => {
  assert.equal(resolveRoute('/').id, 'site-review');
  assert.equal(resolveRoute('/sites/review').id, 'site-review');
  assert.equal(resolveRoute('/sites/review/').id, 'site-review');
});

test('returns a not-found route for unknown paths', () => {
  const route = resolveRoute('/unknown');
  assert.equal(route.id, 'not-found');
  assert.equal(route.status, 404);
});
