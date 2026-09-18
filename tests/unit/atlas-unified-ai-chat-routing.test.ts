import { describe, expect, it } from 'vitest';
import {
  createIntelligenceRouter,
  normalizeIntelligenceRequest,
} from '../../supabase/functions/atlas-copilot/intelligence-gateway.mjs';

type Provider = {
  id: 'openai' | 'bedrock' | 'gemini' | 'codex-sovereign';
  configured: boolean;
  verified: boolean;
  capabilities: string[];
  profiles: string[];
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

  it('prefers an explicitly declared zero-cost provider before a paid primary in auto mode', () => {
    const router = createIntelligenceRouter({
      providers: [provider('openai'), provider('gemini'), provider('codex-sovereign')],
      preferredProviders: ['codex-sovereign'],
    });
    expect(router.route({ mode: 'auto', intent: 'balanced', capabilities_requested: ['generation'] })).toMatchObject({
      mode: 'auto',
      providers: ['codex-sovereign'],
      reason: 'auto_zero_cost_verified_provider',
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
