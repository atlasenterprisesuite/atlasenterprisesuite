import { describe, expect, it } from 'vitest';
import { ProviderRegistry } from '../../packages/execution/src/index';

describe('execution provider registry', () => {
  it('returns executable capabilities only for verified providers', () => {
    const registry = new ProviderRegistry([
      { providerId: 'openai', organizationId: 'org-1', state: 'verified', capabilities: ['reasoning'], lastVerifiedAt: '2026-09-12T00:00:00Z', lastErrorCode: null }
    ]);
    expect(registry.executableCapabilities('openai')).toEqual(['reasoning']);
  });

  it('returns provider_unverified for configured but unverified providers', () => {
    const registry = new ProviderRegistry([
      { providerId: 'openai', organizationId: 'org-1', state: 'configured_unverified', capabilities: ['reasoning'], lastVerifiedAt: null, lastErrorCode: null }
    ]);
    expect(() => registry.executableCapabilities('openai')).toThrow('provider_unverified');
  });
});
