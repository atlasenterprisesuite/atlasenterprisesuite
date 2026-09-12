import test from 'node:test';
import assert from 'node:assert/strict';
import { createShortcutDefinition, validateShortcutDefinition } from '../src/modules/automations/shortcut-definition.js';

const fixedNow = () => '2026-09-03T12:00:00.000Z';
const fixedId = () => 'shortcut-1';

function base(overrides = {}) {
  return {
    tenantId: 'tenant-a',
    name: 'Start Work',
    trigger: { type: 'manual', config: {} },
    actions: [{ type: 'atlas.workspace.open', input: {} }],
    createdBy: 'user-1',
    ...overrides
  };
}

test('creates a disabled normalized shortcut with defaults', () => {
  const shortcut = createShortcutDefinition(base(), { now: fixedNow, id: fixedId });
  assert.equal(shortcut.id, 'shortcut-1');
  assert.equal(shortcut.enabled, false);
  assert.equal(shortcut.description, '');
  assert.deepEqual(shortcut.conditions, []);
  assert.equal(shortcut.actions[0].required, true);
  assert.equal(shortcut.createdAt, fixedNow());
  assert.equal(shortcut.updatedAt, fixedNow());
});

test('accepts supported trigger and condition types', () => {
  const input = base({
    trigger: { type: 'module.event', config: { event: 'payroll.closed' } },
    conditions: [
      { type: 'equals', path: 'event.status', value: 'ready' },
      { type: 'notEquals', path: 'event.mode', value: 'blocked' },
      { type: 'in', path: 'event.role', value: ['owner', 'admin'] },
      { type: 'exists', path: 'event.approved' }
    ]
  });
  assert.equal(validateShortcutDefinition(input), true);
});

test('rejects unsupported trigger and condition types', () => {
  assert.throws(() => createShortcutDefinition(base({ trigger: { type: 'device.magic', config: {} } })), error => error.code === 'INVALID_SHORTCUT');
  assert.throws(() => createShortcutDefinition(base({ conditions: [{ type: 'greaterThan', path: 'event.x', value: 2 }] })), error => error.code === 'INVALID_SHORTCUT');
});

test('rejects empty action arrays and empty action types', () => {
  assert.throws(() => createShortcutDefinition(base({ actions: [] })), error => error.code === 'INVALID_SHORTCUT');
  assert.throws(() => createShortcutDefinition(base({ actions: [{ type: '   ', input: {} }] })), error => error.code === 'INVALID_SHORTCUT');
});

test('rejects arbitrary executable shortcut payloads recursively', () => {
  for (const [key, value] of [
    ['command', 'rm -rf /'],
    ['shell', '/bin/sh'],
    ['script', 'danger()'],
    ['eval', 'danger()'],
    ['function', 'danger()'],
    ['dynamicImport', './remote.js']
  ]) {
    assert.throws(() => createShortcutDefinition(base({
      actions: [{ type: 'atlas.test', input: { nested: { [key]: value } } }]
    })), error => error.code === 'INVALID_SHORTCUT');
  }
});

test('returns defensive clones rather than caller-owned references', () => {
  const input = base({ actions: [{ type: 'atlas.workspace.open', input: { panel: 'home' } }] });
  const shortcut = createShortcutDefinition(input, { now: fixedNow, id: fixedId });
  input.actions[0].input.panel = 'mutated';
  assert.equal(shortcut.actions[0].input.panel, 'home');
});
