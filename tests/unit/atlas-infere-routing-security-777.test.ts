import { describe, expect, it } from 'vitest';
import { createIntelligenceRouter } from '../../supabase/functions/atlas-copilot/intelligence-gateway.mjs';

const ready = (id: string) => ({
  id, configured: true, verified: true,
  capabilities: ['generation', 'reasoning'],
  profiles: ['fast', 'balanced', 'deep'],
});

describe('ATLAS IntelligenceRouter authorization regression', () => {
  it('denies explicit providers excluded from the allowlist', () => {
    const router = createIntelligenceRouter({
      providers: [ready('atlas-local'), ready('openai')],
      allowedProviders: ['atlas-local'],
    });
    expect(() => router.route({
      mode: 'openai', intent: 'balanced',
      capabilities_requested: ['generation'],
    })).toThrowError(/provider_not_allowed/);
  });

  it('treats a nonempty, invalid-only allowlist as deny-all', () => {
    const router = createIntelligenceRouter({
      providers: [ready('atlas-local')],
      allowedProviders: ['unknown-provider'],
    });
    expect(() => router.route({
      mode: 'atlas-local', intent: 'fast',
      capabilities_requested: ['generation'],
    })).toThrowError(/provider_not_allowed/);
    expect(() => router.route({
      mode: 'auto', intent: 'fast',
      capabilities_requested: ['generation'],
    })).toThrowError();
  });

  it('permits an explicitly authorized, verified provider', () => {
    const router = createIntelligenceRouter({
      providers: [ready('atlas-local'), ready('openai')],
      allowedProviders: ['atlas-local'],
    });
    expect(router.route({
      mode: 'atlas-local', intent: 'balanced',
      capabilities_requested: ['generation'],
    }).provider).toBe('atlas-local');
  });

  it('rejects forbidden providers in council mode', () => {
    const router = createIntelligenceRouter({
      providers: [ready('atlas-local'), ready('openai'), ready('gemini')],
      allowedProviders: ['atlas-local', 'openai'],
    });
    expect(router.route({
      mode: 'council', intent: 'balanced',
      capabilities_requested: ['generation'],
    }).providers).toEqual(['atlas-local', 'openai']);
  });
});
