import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryAutomationStore } from '../src/modules/automations/automation-store.js';

const shortcut = { id: 'same-id', tenantId: 'tenant-a', name: 'A', enabled: false };

test('does not expose a shortcut across tenants', () => {
  const store = createMemoryAutomationStore();
  store.createShortcut('tenant-a', shortcut);
  assert.equal(store.getShortcut('tenant-b', 'same-id'), null);
  assert.deepEqual(store.listShortcuts('tenant-b'), []);
});

test('returns defensive copies for shortcut storage', () => {
  const store = createMemoryAutomationStore();
  const input = structuredClone(shortcut);
  const stored = store.createShortcut('tenant-a', input);
  input.name = 'input-mutated';
  stored.name = 'return-mutated';
  assert.equal(store.getShortcut('tenant-a', shortcut.id).name, 'A');
});

test('updates and deletes only within the tenant boundary', () => {
  const store = createMemoryAutomationStore();
  store.createShortcut('tenant-a', shortcut);
  assert.equal(store.updateShortcut('tenant-b', shortcut.id, { name: 'B' }), null);
  assert.equal(store.updateShortcut('tenant-a', shortcut.id, { name: 'Updated' }).name, 'Updated');
  assert.equal(store.deleteShortcut('tenant-b', shortcut.id), null);
  assert.equal(store.deleteShortcut('tenant-a', shortcut.id).id, shortcut.id);
  assert.equal(store.getShortcut('tenant-a', shortcut.id), null);
});

test('stores execution records by tenant and returns defensive copies', () => {
  const store = createMemoryAutomationStore();
  const execution = { executionId: 'e1', tenantId: 'tenant-a', status: 'success', actionResults: [] };
  const saved = store.saveExecution('tenant-a', execution);
  saved.status = 'mutated';
  assert.equal(store.listExecutions('tenant-a')[0].status, 'success');
  assert.deepEqual(store.listExecutions('tenant-b'), []);
});
