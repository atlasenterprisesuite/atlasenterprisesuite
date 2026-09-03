import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionRegistry } from '../src/modules/automations/action-registry.js';

const context = { tenantId: 'tenant-a', actor: { userId: 'u1' }, shortcut: { id: 's1' }, input: { value: 7 }, services: {} };

test('executes only a registered action adapter', async () => {
  const registry = createActionRegistry();
  registry.register('atlas.echo', async ({ input }) => ({ echoed: input.value }));
  assert.equal(registry.has('atlas.echo'), true);
  const result = await registry.execute('atlas.echo', context);
  assert.deepEqual(result, { type: 'atlas.echo', status: 'success', output: { echoed: 7 } });
});

test('rejects duplicate adapter registrations', () => {
  const registry = createActionRegistry();
  registry.register('atlas.echo', async () => ({}));
  assert.throws(() => registry.register('atlas.echo', async () => ({})), error => error.code === 'DUPLICATE_ACTION_TYPE');
});

test('marks a missing adapter unavailable', async () => {
  const registry = createActionRegistry();
  const result = await registry.execute('atlas.network.scan', context);
  assert.deepEqual(result, { type: 'atlas.network.scan', status: 'unavailable', errorCode: 'ACTION_UNAVAILABLE' });
});

test('converts adapter exceptions into safe failed results', async () => {
  const registry = createActionRegistry();
  registry.register('atlas.fail', async () => { throw new Error('secret provider detail'); });
  const result = await registry.execute('atlas.fail', context);
  assert.deepEqual(result, { type: 'atlas.fail', status: 'failed', errorCode: 'ACTION_FAILED' });
  assert.equal(JSON.stringify(result).includes('secret provider detail'), false);
});
