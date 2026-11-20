import { describe, expect, it } from 'vitest';
import { createIntelligenceRouter, normalizeIntelligenceRequest } from '../../supabase/functions/atlas-copilot/intelligence-gateway.mjs';

const provider = (id: string, verified = true) => ({
  id, configured: true, verified,
  capabilities: ['generation', 'reasoning'],
  profiles: ['fast', 'balanced', 'deep'],
});

describe('Enterprise AI 777 P0 routing policy', () => {
  it('rejects unsupported capability escalation', () => {
    expect(() => normalizeIntelligenceRequest({ message: 'test', capabilities_requested: ['admin'] }))
      .toThrowError(/capability_unavailable/);
  });

  it('rejects unverified providers in automatic selection', () => {
    const router = createIntelligenceRouter({ providers: [provider('openai', false)] });
    expect(() => router.route({ mode: 'auto' })).toThrowError(/capability_unavailable/);
  });

  it('does not select providers outside organization allowlist', () => {
    const router = createIntelligenceRouter({
      providers: [provider('openai'), provider('gemini')],
      allowedProviders: ['gemini'],
    });
    const route = router.route({ mode: 'auto' });
    expect(route.provider).toBe('gemini');
    expect(route.fallback_providers).not.toContain('openai');
  });

  it('requires two verified and allowed providers for council', () => {
    const router = createIntelligenceRouter({
      providers: [provider('openai'), provider('gemini')],
      allowedProviders: ['gemini'],
    });
    expect(() => router.route({ mode: 'council' })).toThrowError(/capability_unavailable/);
  });
});
