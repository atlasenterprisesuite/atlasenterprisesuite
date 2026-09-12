import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionRegistry } from '../src/modules/automations/action-registry.js';
import { createAutomationEngine } from '../src/modules/automations/automation-engine.js';
import { createMemoryAutomationStore } from '../src/modules/automations/automation-store.js';
import { createAutomationService } from '../src/modules/automations/automation-service.js';

const NOW = '2026-09-03T12:00:00.000Z';
const ownerA = { tenantId: 'tenant-a', userId: 'owner-a', role: 'owner' };
const ownerB = { tenantId: 'tenant-b', userId: 'owner-b', role: 'owner' };
const developerA = { tenantId: 'tenant-a', userId: 'dev-a', role: 'developer' };
const clientA = { tenantId: 'tenant-a', userId: 'client-a', role: 'client' };

function input(overrides = {}) {
  return {
    name: 'Manual Test',
    description: 'test',
    trigger: { type: 'manual', config: {} },
    conditions: [],
    actions: [{ type: 'atlas.ok', input: { value: 3 } }],
    ...overrides
  };
}

function harness() {
  let shortcutCounter = 0;
  let executionCounter = 0;
  const store = createMemoryAutomationStore();
  const registry = createActionRegistry();
  registry.register('atlas.ok', async ({ input }) => ({ value: input.value }));
  registry.register('atlas.fail', async () => { throw new Error('provider secret'); });
  const engine = createAutomationEngine({
    registry,
    now: () => NOW,
    id: () => `execution-${++executionCounter}`
  });
  const service = createAutomationService({
    store,
    engine,
    now: () => NOW,
    id: () => `shortcut-${++shortcutCounter}`,
    auditId: () => `denied-${++executionCounter}`
  });
  return { store, registry, engine, service };
}

test('developer can create read update and execute but cannot manage or delete', async () => {
  const { service } = harness();
  const created = service.createShortcut(developerA, { ...input(), tenantId: 'attacker', createdBy: 'attacker' });
  assert.equal(created.tenantId, 'tenant-a');
  assert.equal(created.createdBy, 'dev-a');
  assert.equal(service.getShortcut(developerA, created.id).id, created.id);
  assert.equal(service.updateShortcut(developerA, created.id, { name: 'Updated', tenantId: 'tenant-b', enabled: true }).name, 'Updated');
  assert.equal(service.getShortcut(developerA, created.id).enabled, false);
  assert.throws(() => service.enableShortcut(developerA, created.id), error => error.code === 'PERMISSION_DENIED');
  assert.throws(() => service.deleteShortcut(developerA, created.id), error => error.code === 'PERMISSION_DENIED');
  const result = await service.executeShortcut(developerA, created.id, { type: 'manual' });
  assert.equal(result.status, 'skipped');
  assert.equal(result.errorCode, 'SHORTCUT_DISABLED');
});

test('owner can manage delete and list shortcuts inside the tenant', () => {
  const { service } = harness();
  const created = service.createShortcut(ownerA, input());
  assert.equal(service.listShortcuts(ownerA).length, 1);
  assert.equal(service.enableShortcut(ownerA, created.id).enabled, true);
  assert.equal(service.disableShortcut(ownerA, created.id).enabled, false);
  assert.equal(service.deleteShortcut(ownerA, created.id).id, created.id);
  assert.equal(service.listShortcuts(ownerA).length, 0);
});

test('cross-tenant guessed ids are not exposed', () => {
  const { service } = harness();
  const created = service.createShortcut(ownerA, input());
  assert.throws(() => service.getShortcut(ownerB, created.id), error => error.code === 'SHORTCUT_NOT_FOUND');
  assert.throws(() => service.updateShortcut(ownerB, created.id, { name: 'Bad' }), error => error.code === 'SHORTCUT_NOT_FOUND');
});

test('records successful failed skipped and unavailable executions', async () => {
  const { service } = harness();
  const ok = service.createShortcut(ownerA, input());
  service.enableShortcut(ownerA, ok.id);
  assert.equal((await service.executeShortcut(ownerA, ok.id, { type: 'manual' })).status, 'success');

  const failing = service.createShortcut(ownerA, input({ actions: [{ type: 'atlas.fail', input: {} }] }));
  service.enableShortcut(ownerA, failing.id);
  assert.equal((await service.executeShortcut(ownerA, failing.id, { type: 'manual' })).status, 'failed');

  const disabled = service.createShortcut(ownerA, input());
  assert.equal((await service.executeShortcut(ownerA, disabled.id, { type: 'manual' })).status, 'skipped');

  const missing = service.createShortcut(ownerA, input({ actions: [{ type: 'atlas.network.diagnostic', input: {} }] }));
  service.enableShortcut(ownerA, missing.id);
  const unavailable = await service.executeShortcut(ownerA, missing.id, { type: 'manual' });
  assert.equal(unavailable.status, 'failed');
  assert.equal(unavailable.actionResults[0].status, 'unavailable');

  assert.deepEqual(service.listExecutions(ownerA).map(item => item.status), ['success', 'failed', 'skipped', 'failed']);
});

test('records a denied execution attempt without requiring read access', async () => {
  const { service } = harness();
  const created = service.createShortcut(ownerA, input());
  const result = await service.executeShortcut(clientA, created.id, { type: 'manual' });
  assert.equal(result.status, 'denied');
  assert.equal(result.actionResults.length, 0);
  assert.equal(result.shortcutId, created.id);
  const audit = service.listExecutions(ownerA);
  assert.equal(audit.at(-1).status, 'denied');
});

test('enforces read and audit capabilities separately', () => {
  const { service } = harness();
  service.createShortcut(ownerA, input());
  assert.equal(service.listShortcuts(clientA).length, 1);
  assert.equal(service.listTemplates(clientA).length, 8);
  assert.throws(() => service.listExecutions(clientA), error => error.code === 'PERMISSION_DENIED');
});

test('rejects malformed actor contexts', () => {
  const { service } = harness();
  assert.throws(() => service.listShortcuts({ tenantId: 'tenant-a', role: 'owner' }), /userId/i);
  assert.throws(() => service.listShortcuts({ userId: 'u', role: 'owner' }), /tenantId/i);
});
