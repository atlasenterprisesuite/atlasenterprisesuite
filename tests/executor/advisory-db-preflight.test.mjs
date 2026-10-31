import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePreflight } from '../../scripts/advisory-db-preflight.mjs';

const tools = Object.fromEntries(['node', 'unshare', 'postgres', 'initdb', 'pg_ctl', 'psql'].map(name => [name, true]));
test('available prerequisites never claim database proof', () => {
  assert.deepEqual(evaluatePreflight({ tools, namespaceAllowed: true, uid: 1000 }), {
    status: 'prerequisites_available', database_proof: 'not_executed', blockers: [],
  });
});
test('reports independent missing database, namespace and user prerequisites', () => {
  const result = evaluatePreflight({ tools: { ...tools, psql: false }, namespaceAllowed: false, uid: 0 });
  assert.equal(result.status, 'blocked');
  assert.deepEqual(result.blockers, ['missing_tool:psql', 'network_namespace_unavailable', 'postgres_requires_non_root_user']);
});
