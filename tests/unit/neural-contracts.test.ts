import { describe, expect, it } from 'vitest';
import { validateNeuralEnvelope } from '../../packages/neural-fabric/src/contracts';

const valid = {
  event_id: 'evt-001',
  schema_version: 1,
  module_id: 'knowledge',
  tenant_id: 'tenant-a',
  actor_id: 'user-1',
  correlation_id: 'corr-001',
  causation_id: null,
  occurred_at: '2026-10-08T12:00:00.000Z',
  sensitivity: 'internal',
  retention_class: 'standard',
  payload_hash: 'a'.repeat(64),
  evidence_ref: null,
};

describe('ATLAS Neural Fabric contract validation', () => {
  it('accepts a valid tenant-scoped envelope', () => {
    expect(validateNeuralEnvelope(valid, 'tenant-a')).toEqual({ ok: true, value: valid });
  });
  it('rejects spoofed tenant context', () => {
    expect(validateNeuralEnvelope(valid, 'tenant-b').ok).toBe(false);
  });
  it('rejects unknown contract versions', () => {
    expect(validateNeuralEnvelope({ ...valid, schema_version: 2 }, 'tenant-a').ok).toBe(false);
  });
  it('rejects missing actor identity', () => {
    expect(validateNeuralEnvelope({ ...valid, actor_id: '' }, 'tenant-a').ok).toBe(false);
  });
  it('rejects malformed timestamps', () => {
    expect(validateNeuralEnvelope({ ...valid, occurred_at: 'yesterday' }, 'tenant-a').ok).toBe(false);
  });
  it('rejects invalid payload hashes', () => {
    expect(validateNeuralEnvelope({ ...valid, payload_hash: 'invalid' }, 'tenant-a').ok).toBe(false);
  });
  it('rejects unknown sensitivity classifications', () => {
    expect(validateNeuralEnvelope({ ...valid, sensitivity: 'public' }, 'tenant-a').ok).toBe(false);
  });
});
