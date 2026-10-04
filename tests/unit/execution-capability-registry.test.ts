import { describe, expect, it } from 'vitest';
import {
  ATLAS_TELECOM_CAPABILITIES,
  listCapabilities,
  resolveCapability
} from '../../packages/execution/src/capability-registry';

describe('ATLAS capability registry', () => {
  it('declares the approved telecom capability set exactly once', () => {
    const ids = ATLAS_TELECOM_CAPABILITIES.map((capability) => capability.id);

    expect(ids).toEqual([
      'communications.voice.readiness',
      'communications.number.search',
      'communications.voice.call.create',
      'communications.webhook.verify',
      'communications.number.provision.test'
    ]);
    expect(new Set(ids).size).toBe(ids.length);

    for (const capability of ATLAS_TELECOM_CAPABILITIES) {
      expect(capability.version).toBe(1);
      expect(capability.domain.trim()).not.toBe('');
      expect(capability.title.trim()).not.toBe('');
      expect(capability.description.trim()).not.toBe('');
      expect(capability.inputSchemaRef.trim()).not.toBe('');
      expect(capability.outputSchemaRef.trim()).not.toBe('');
      expect(capability.verificationPolicy.trim()).not.toBe('');
      if (capability.riskTier === 'P0') {
        expect(capability.requiresEvidence).toBe(true);
      }
    }
  });

  it('keeps provider bindings declarative and secret-free', () => {
    const serialized = JSON.stringify(ATLAS_TELECOM_CAPABILITIES);
    expect(serialized).not.toMatch(/api.?key|secret|token|credential_value/i);

    for (const capability of ATLAS_TELECOM_CAPABILITIES) {
      for (const binding of capability.providerBindings) {
        expect(binding.provider.trim()).not.toBe('');
        expect(binding.adapter.trim()).not.toBe('');
        expect(binding.environments.length).toBeGreaterThan(0);
        expect(Number.isFinite(binding.priority)).toBe(true);
        expect(binding.healthCheck.trim()).not.toBe('');
      }
    }
  });

  it('resolves by id and filters by domain', () => {
    expect(resolveCapability('communications.voice.readiness').operation).toBe('read');
    expect(listCapabilities('communications')).toHaveLength(5);
    expect(listCapabilities('finance')).toEqual([]);
  });

  it('fails closed for unknown capability ids', () => {
    expect(() => resolveCapability('unknown')).toThrow('capability_not_found:unknown');
  });
});
