import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionRegistry } from '../src/modules/automations/action-registry.js';
import { createAutomationEngine } from '../src/modules/automations/automation-engine.js';

const actor = { tenantId: 'tenant-a', userId: 'user-1', role: 'owner' };
const fixedNow = () => '2026-09-03T12:00:00.000Z';
const fixedId = () => 'execution-1';

function shortcut(overrides = {}) {
  return {
    id: 'shortcut-1', tenantId: 'tenant-a', name: 'Test', description: '', enabled: true,
    trigger: { type: 'manual', config: {} }, conditions: [],
    actions: [{ type: 'atlas.ok', input: {}, required: true }],
    createdBy: 'user-1', createdAt: fixedNow(), updatedAt: fixedNow(), ...overrides
  };
}

function harness() {
  const registry = createActionRegistry();
  registry.register('atlas.ok', async ({ input }) => ({ ok: true, input }));
  return { registry, engine: createAutomationEngine({ registry, now: fixedNow, id: fixedId }) };
}

test('executes a matching enabled shortcut and returns a safe execution record', async () => {
  const { engine } = harness();
  const result = await engine.execute({ shortcut: shortcut(), event: { type: 'manual' }, actor });
  assert.equal(result.executionId, 'execution-1');
  assert.equal(result.status, 'success');
  assert.equal(result.actorUserId, 'user-1');
  assert.equal(result.actionResults[0].status, 'success');
  assert.equal('role' in result, false);
});

test('skips disabled shortcuts before actions run', async () => {
  const { engine } = harness();
  const result = await engine.execute({ shortcut: shortcut({ enabled: false }), event: { type: 'manual' }, actor });
  assert.equal(result.status, 'skipped');
  assert.deepEqual(result.actionResults, []);
  assert.equal(result.errorCode, 'SHORTCUT_DISABLED');
});

test('skips trigger mismatches including namespaced module events', async () => {
  const { engine } = harness();
  const result = await engine.execute({
    shortcut: shortcut({ trigger: { type: 'module.event', config: { event: 'payroll.closed' } } }),
    event: { type: 'module.event', name: 'payroll.started' }, actor
  });
  assert.equal(result.status, 'skipped');
  assert.equal(result.errorCode, 'TRIGGER_MISMATCH');
});

test('matches schedule and network events only when configured event identifiers agree', async () => {
  const { engine } = harness();
  const network = shortcut({ trigger: { type: 'network.event', config: { event: 'trusted-device.joined' } } });
  const yes = await engine.execute({ shortcut: network, event: { type: 'network.event', name: 'trusted-device.joined' }, actor });
  const no = await engine.execute({ shortcut: network, event: { type: 'network.event', name: 'unknown-device.detected' }, actor });
  assert.equal(yes.status, 'success');
  assert.equal(no.status, 'skipped');

  const scheduled = shortcut({ trigger: { type: 'schedule', config: { scheduleId: 'payroll-friday' } } });
  assert.equal((await engine.execute({ shortcut: scheduled, event: { type: 'schedule', scheduleId: 'payroll-friday' }, actor })).status, 'success');
  assert.equal((await engine.execute({ shortcut: scheduled, event: { type: 'schedule', scheduleId: 'other' }, actor })).status, 'skipped');
});

test('evaluates equals, notEquals, in and exists conditions and treats unknown paths as unmet', async () => {
  const { engine } = harness();
  const conditioned = shortcut({ conditions: [
    { type: 'equals', path: 'event.status', value: 'ready' },
    { type: 'notEquals', path: 'event.mode', value: 'blocked' },
    { type: 'in', path: 'actor.role', value: ['owner', 'admin'] },
    { type: 'exists', path: 'event.approved' }
  ]});
  const pass = await engine.execute({ shortcut: conditioned, event: { type: 'manual', status: 'ready', mode: 'normal', approved: false }, actor });
  assert.equal(pass.status, 'success');
  const fail = await engine.execute({ shortcut: shortcut({ conditions: [{ type: 'equals', path: 'event.missing.path', value: 1 }] }), event: { type: 'manual' }, actor });
  assert.equal(fail.status, 'skipped');
  assert.equal(fail.errorCode, 'CONDITIONS_UNMET');
});

test('stops after a failed required action', async () => {
  const { registry, engine } = harness();
  registry.register('atlas.fail', async () => { throw new Error('boom'); });
  const result = await engine.execute({ shortcut: shortcut({ actions: [
    { type: 'atlas.fail', input: {}, required: true },
    { type: 'atlas.ok', input: {}, required: true }
  ] }), event: { type: 'manual' }, actor });
  assert.equal(result.status, 'failed');
  assert.equal(result.actionResults.length, 1);
});

test('continues after a failed optional action and records unavailable required actions as failure', async () => {
  const { registry, engine } = harness();
  registry.register('atlas.fail', async () => { throw new Error('boom'); });
  const optional = await engine.execute({ shortcut: shortcut({ actions: [
    { type: 'atlas.fail', input: {}, required: false },
    { type: 'atlas.ok', input: {}, required: true }
  ] }), event: { type: 'manual' }, actor });
  assert.equal(optional.status, 'success');
  assert.equal(optional.actionResults.length, 2);
  const missing = await engine.execute({ shortcut: shortcut({ actions: [{ type: 'atlas.network.diagnostic', input: {}, required: true }] }), event: { type: 'manual' }, actor });
  assert.equal(missing.status, 'failed');
  assert.equal(missing.actionResults[0].status, 'unavailable');
});
