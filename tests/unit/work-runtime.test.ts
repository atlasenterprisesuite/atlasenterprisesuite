import { expect, it } from 'vitest';
import { selectWorkRuntime } from '../../packages/execution/src/work-runtime';

const now = '2026-09-12T21:00:00Z';
const runtimes = [
  { id: 'local-1', kind: 'local' as const, status: 'online' as const, capabilities: ['browser'], lastSeenAt: '2026-09-12T20:59:30Z' },
  { id: 'self-1', kind: 'self_hosted' as const, status: 'online' as const, capabilities: ['browser'], lastSeenAt: '2026-09-12T20:59:20Z' },
  { id: 'cloud-1', kind: 'cloud_ephemeral' as const, status: 'online' as const, capabilities: ['browser'], lastSeenAt: '2026-09-12T20:59:10Z' }
];

it('auto chooses healthy Local then Self-Hosted then Cloud Ephemeral', () => {
  expect(selectWorkRuntime({ preference: 'auto', requiredCapabilities: ['browser'], runtimes }, now).runtimeId).toBe('local-1');
  expect(selectWorkRuntime({ preference: 'auto', requiredCapabilities: ['browser'], runtimes: runtimes.slice(1) }, now).runtimeId).toBe('self-1');
  expect(selectWorkRuntime({ preference: 'auto', requiredCapabilities: ['browser'], runtimes: runtimes.slice(2) }, now).runtimeId).toBe('cloud-1');
});

it('requires the explicitly requested runtime kind', () => {
  expect(selectWorkRuntime({ preference: 'self_hosted', requiredCapabilities: ['browser'], runtimes }, now).runtimeId).toBe('self-1');
});

it('rejects runtimes stale by more than 120 seconds', () => {
  expect(selectWorkRuntime({
    preference: 'local', requiredCapabilities: ['browser'],
    runtimes: [{ ...runtimes[0], lastSeenAt: '2026-09-12T20:57:59Z' }]
  }, now).state).toBe('blocked');
});

it('rejects revoked offline and degraded runtimes', () => {
  for (const status of ['revoked', 'offline', 'degraded'] as const) {
    expect(selectWorkRuntime({ preference: 'local', requiredCapabilities: ['browser'], runtimes: [{ ...runtimes[0], status }] }, now).state).toBe('blocked');
  }
});
