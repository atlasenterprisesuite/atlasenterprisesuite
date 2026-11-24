import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOpenCodeRole, OPENCODE_ROLE_BINDINGS } from '../../packages/agent-registry/src/opencode-compatibility.mjs';

const agents = [
  { id: 'atlas-architect', capabilities: ['architect', 'plan'], allowedEnvironments: ['development', 'test'] },
  { id: 'atlas-openai-engineer', capabilities: ['implement'], allowedEnvironments: ['development', 'test'] },
  { id: 'atlas-reviewer', capabilities: ['review'], allowedEnvironments: ['development', 'test', 'production'] },
];

test('maps all seven OpenCode roles onto existing ATLAS agents', () => {
  assert.equal(Object.keys(OPENCODE_ROLE_BINDINGS).length, 7);
  for (const role of Object.keys(OPENCODE_ROLE_BINDINGS)) {
    assert.equal(resolveOpenCodeRole(role, agents), OPENCODE_ROLE_BINDINGS[role]);
  }
});

test('fails closed for unknown or prototype-inherited roles', () => {
  for (const role of ['admin', 'release-governor', 'toString', '__proto__', '', null]) {
    assert.throws(() => resolveOpenCodeRole(role, agents), /Unsupported OpenCode role/);
  }
});

test('blocks production and unsupported execution environments', () => {
  for (const environment of ['production', 'staging', '']) {
    assert.throws(() => resolveOpenCodeRole('developer', agents, { environment }), /restricted/);
  }
});

test('rejects unregistered, unauthorized and capability-mismatched agents', () => {
  assert.throws(() => resolveOpenCodeRole('backend', []), /not registered/);
  assert.throws(() => resolveOpenCodeRole('backend', [{ ...agents[1], allowedEnvironments: ['production'] }]), /not allowed/);
  assert.throws(() => resolveOpenCodeRole('backend', [{ ...agents[1], capabilities: ['review'] }]), /lacks/);
  assert.throws(() => resolveOpenCodeRole('developer', null), /registry is required/);
});

test('security auditor maps only to a review-capable agent', () => {
  assert.equal(resolveOpenCodeRole('security-auditor', agents), 'atlas-reviewer');
  assert.throws(() => resolveOpenCodeRole('security-auditor', [{ ...agents[2], capabilities: ['implement'] }]), /lacks/);
});
