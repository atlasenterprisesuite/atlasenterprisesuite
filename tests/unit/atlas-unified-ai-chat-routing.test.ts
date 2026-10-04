import { describe, expect, it } from 'vitest';
import {
  createIntelligenceRouter,
  normalizeIntelligenceRequest,
} from '../../supabase/functions/atlas-copilot/intelligence-gateway.mjs';

type Provider = {
  id: 'atlas-local' | 'openai' | 'bedrock' | 'gemini' | 'codex-sovereign';
  configured: boolean;
  verified: boolean;
  capabilities: string[];
  profiles: string[];
  model?: string | null;
  model_verification_state?: string;
};

const provider = (id: Provider['id'], overrides: Partial<Provider> = {}): Provider => ({
  id,
  configured: true,
  verified: true,
  capabilities: ['generation', 'reasoning'],
  profiles: ['fast', 'balanced', 'deep'],
  ...overrides,
});

describe('ATLAS Unified AI routing', () => {
  it('normalizes requests to auto mode by default', () => {
    const request = normalizeIntelligenceRequest({ message: 'Summarize payroll risk.' });
    expect(request.mode).toBe('auto');
    expect(request.intent).toBe('balanced');
  });

  it('normalizes an explicit model pin without changing provider mode', () => {
    const request = normalizeIntelligenceRequest({
      message: 'Review the repository.',
      mode: 'openai',
      model: '  gpt-6.1-sol  ',
    });
    expect(request.mode).toBe('openai');
    expect(request.model).toBe('gpt-6.1-sol');
  });

  it('routes an explicit provider without silent fallback', () => {
    const router = createIntelligenceRouter({
      providers: [provider('openai'), provider('bedrock'), provider('gemini'), provider('codex-sovereign')],
    });
    expect(router.route({ mode: 'gemini', intent: 'deep', capabilities_requested: ['reasoning'] })).toMatchObject({
      mode: 'gemini',
      providers: ['gemini'],
      profile: 'deep',
      capabilities: ['reasoning'],
      fallback_used: false,
    });
  });

  it('keeps model identity inside the selected provider boundary', () => {
    const router = createIntelligenceRouter({
      providers: [provider('openai', { model: 'gpt-6.1-sol', model_verification_state: 'verified' })],
    });
    const result = router.route({
      mode: 'openai',
      intent: 'balanced',
      model: 'gpt-6.1-sol',
      capabilities_requested: ['generation'],
    });
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-6.1-sol');
    expect(result.model_verification_state).toBe('verified');
    expect(result.providers).toEqual(['openai']);
  });

  it('fails closed when an explicitly pinned model is not verified', () => {
    const router = createIntelligenceRouter({
      providers: [provider('openai', { model: 'gpt-6-astra', model_verification_state: 'verified' })],
    });
    expect(() => router.route({
      mode: 'openai',
      intent: 'balanced',
      model: 'unverified-model',
      capabilities_requested: ['generation'],
    })).toThrowError(/model_unavailable/);
  });

  it('enforces a non-empty server model allowlist', () => {
    const router = createIntelligenceRouter({
      providers: [provider('openai', { model: 'gpt-6-astra', model_verification_state: 'verified' })],
      allowedModels: ['openai/gpt-6.1-sol'],
    });
    expect(() => router.route({
      mode: 'openai',
      intent: 'balanced',
      model: 'gpt-6-astra',
      capabilities_requested: ['generation'],
    })).toThrowError(/model_not_allowed/);
  });

  it('fails closed when an explicitly selected provider is not verified', () => {
    const router = createIntelligenceRouter({
      providers: [provider('openai', { configured: false, verified: false }), provider('gemini')],
    });
    expect(() => router.route({ mode: 'openai', intent: 'balanced', capabilities_requested: ['generation'] }))
      .toThrowError(/provider_not_configured/);
  });

  it('selects the first verified capability match deterministically in auto mode', () => {
    const router = createIntelligenceRouter({
      providers: [
        provider('openai', { verified: false }),
        provider('gemini'),
        provider('codex-sovereign'),
      ],
    });
    expect(router.route({ mode: 'auto', intent: 'balanced', capabilities_requested: ['generation'] })).toMatchObject({
      mode: 'auto',
      providers: ['gemini'],
      fallback_used: true,
    });
  });

  it('auto mode skips providers whose verified model does not match an explicit model pin', () => {
    const router = createIntelligenceRouter({
      providers: [
        provider('openai', { model: 'gpt-6-astra', model_verification_state: 'verified' }),
        provider('gemini', { model: 'gpt-6.1-sol', model_verification_state: 'verified' }),
      ],
    });
    expect(router.route({
      mode: 'auto',
      intent: 'balanced',
      model: 'gpt-6.1-sol',
      capabilities_requested: ['generation'],
    })).toMatchObject({
      mode: 'auto',
      provider: 'gemini',
      providers: ['gemini'],
      model: 'gpt-6.1-sol',
      model_verification_state: 'verified',
      fallback_used: true,
    });
  });

  it('prefers an explicitly declared zero-cost provider before a paid primary in auto mode', () => {
    const router = createIntelligenceRouter({
      providers: [provider('atlas-local'), provider('openai'), provider('gemini'), provider('codex-sovereign')],
      preferredProviders: ['atlas-local'],
    });
    expect(router.route({ mode: 'auto', intent: 'balanced', capabilities_requested: ['generation'] })).toMatchObject({
      mode: 'auto',
      providers: ['atlas-local'],
      fallback_providers: ['openai', 'gemini', 'codex-sovereign'],
      reason: 'auto_zero_cost_verified_provider',
      fallback_used: false,
    });
  });

  it('selects only organization-allowed providers in auto mode', () => {
    const router = createIntelligenceRouter({
      providers: [provider('openai'), provider('gemini'), provider('codex-sovereign')],
      allowedProviders: ['gemini'],
    });
    expect(router.route({ mode: 'auto', intent: 'balanced', capabilities_requested: ['generation'] })).toMatchObject({
      mode: 'auto',
      providers: ['gemini'],
      fallback_used: true,
    });
  });

  it('requires at least two verified providers for council mode', () => {
    const router = createIntelligenceRouter({
      providers: [provider('openai'), provider('gemini', { verified: false })],
    });
    expect(() => router.route({ mode: 'council', intent: 'balanced', capabilities_requested: ['generation'] }))
      .toThrowError(/capability_unavailable/);
  });

  it('returns all verified compatible providers in stable council order', () => {
    const router = createIntelligenceRouter({
      providers: [provider('openai'), provider('bedrock'), provider('gemini'), provider('codex-sovereign')],
    });
    expect(router.route({ mode: 'council', intent: 'deep', capabilities_requested: ['reasoning'] })).toMatchObject({
      mode: 'council',
      providers: ['openai', 'bedrock', 'gemini', 'codex-sovereign'],
      profile: 'deep',
      fallback_used: false,
    });
  });
});
