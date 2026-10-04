import { describe, expect, it } from 'vitest';
import { createProviderRegistry } from '../../supabase/functions/atlas-copilot/provider-registry.mjs';
import { createCouncilOrchestrator } from '../../supabase/functions/atlas-copilot/council-orchestrator.mjs';
import { createToolGateway } from '../../supabase/functions/atlas-copilot/tool-gateway.mjs';
import { evaluateEmergencyFallbackPolicy, evaluateIntelligenceCostPolicy } from '../../supabase/functions/atlas-copilot/cost-policy.mjs';

function adapter(id: 'atlas-local' | 'openai' | 'anthropic' | 'bedrock' | 'gemini' | 'codex-sovereign', options: {
  configured?: boolean;
  verified?: boolean;
  text?: string;
  fail?: boolean;
} = {}) {
  const configured = options.configured ?? true;
  const verified = options.verified ?? true;
  return {
    descriptor: () => ({
      id,
      configured,
      verified: false,
      capabilities: ['generation', 'reasoning'],
      profiles: ['fast', 'balanced', 'deep'],
      model: `${id}-model`,
    }),
    probe: async () => ({
      configured,
      verified,
      provider: id,
      model: `${id}-model`,
      error: verified ? null : configured ? 'provider_unavailable' : 'provider_not_configured',
    }),
    execute: async () => {
      if (options.fail) throw Object.assign(new Error('provider_unavailable'), { code: 'provider_unavailable', status: 502 });
      return {
        provider: id,
        model: `${id}-model`,
        text: options.text ?? `${id} answer`,
        capabilities_used: ['generation'],
        usage: { output_tokens: 10 },
        provenance: [],
        tool_calls: [],
      };
    },
  };
}

describe('ATLAS provider registry', () => {
  it('returns sanitized mixed readiness states in canonical order', async () => {
    const registry = createProviderRegistry({
      providers: [
        adapter('atlas-local', { configured: false, verified: false }),
        adapter('openai'),
        adapter('bedrock', { verified: false }),
        adapter('gemini', { configured: false, verified: false }),
        adapter('codex-sovereign', { verified: false }),
      ],
    });
    const readiness = await registry.readiness({ profile: 'balanced' });
    expect(readiness.map((item: any) => [item.id, item.state])).toEqual([
      ['atlas-local', 'configuration-required'],
      ['openai', 'verified'],
      ['anthropic', 'configuration-required'],
      ['bedrock', 'unavailable'],
      ['gemini', 'configuration-required'],
      ['codex-sovereign', 'unavailable'],
    ]);
    expect(JSON.stringify(readiness)).not.toContain('secret');
  });

  it('probes configured providers concurrently while preserving canonical result order', async () => {
    let started = 0;
    let release: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const concurrentAdapter = (id: 'openai' | 'gemini') => ({
      descriptor: () => ({
        id,
        configured: true,
        capabilities: ['generation'],
        profiles: ['balanced'],
        model: id + '-model',
      }),
      probe: async () => {
        started += 1;
        if (started === 2) release?.();
        await gate;
        return { configured: true, verified: true, provider: id, model: id + '-model', error: null };
      },
    });
    const registry = createProviderRegistry({ providers: [concurrentAdapter('openai'), concurrentAdapter('gemini')] });
    const readiness = await registry.readiness({ profile: 'balanced' });
    expect(started).toBe(2);
    expect(readiness.filter((item: any) => item.verified).map((item: any) => item.id)).toEqual(['openai', 'gemini']);
  });

  it('returns an adapter by provider id without exposing credentials', () => {
    const openai = adapter('openai');
    const registry = createProviderRegistry({ providers: [openai] });
    expect(registry.get('openai')).toBe(openai);
    expect(registry.get('gemini')).toBeNull();
  });
});

describe('ATLAS Council', () => {
  it('reconciles two successful contributions in stable provider order', async () => {
    const registry = createProviderRegistry({ providers: [adapter('openai', { text: 'OpenAI answer' }), adapter('gemini', { text: 'Gemini answer' })] });
    const council = createCouncilOrchestrator({ registry });
    const result = await council.execute({
      providerIds: ['openai', 'gemini'],
      context: { user_id: 'user-1', organization_id: 'org-1' },
      route: { profile: 'balanced', capabilities: ['generation'] },
      instructions: 'ATLAS',
      input: [{ role: 'user', content: 'Compare' }],
      max_output_tokens: 100,
    });
    expect(result.provider).toBe('council');
    expect(result.contributions.map((item: any) => item.provider)).toEqual(['openai', 'gemini']);
    expect(result.text).toContain('OpenAI answer');
    expect(result.text).toContain('Gemini answer');
  });

  it('fails when fewer than two providers succeed', async () => {
    const registry = createProviderRegistry({ providers: [adapter('openai'), adapter('gemini', { fail: true })] });
    const council = createCouncilOrchestrator({ registry });
    await expect(council.execute({
      providerIds: ['openai', 'gemini'],
      context: { user_id: 'user-1', organization_id: 'org-1' },
      route: { profile: 'balanced', capabilities: ['generation'] },
      instructions: 'ATLAS',
      input: [{ role: 'user', content: 'Compare' }],
    })).rejects.toThrow(/capability_unavailable/);
  });
});

describe('ATLAS Tool Gateway', () => {
  it('deduplicates identical side-effect proposals from multiple providers', () => {
    const gateway = createToolGateway({ sideEffectTools: ['send_email'] });
    const proposals = gateway.evaluate({
      proposals: [
        { provider: 'openai', name: 'send_email', arguments: { to: 'a@example.com' }, permission: 'email.send' },
        { provider: 'gemini', name: 'send_email', arguments: { to: 'a@example.com' }, permission: 'email.send' },
      ],
      context: { permissions: ['email.send'] },
    });
    expect(proposals.approval_required).toHaveLength(1);
    expect(proposals.approval_required[0].providers.sort()).toEqual(['gemini', 'openai']);
  });

  it('does not deduplicate distinct proposals that collide in the audit hash', () => {
    const gateway = createToolGateway({ sideEffectTools: ['send_email'], hashFn: () => 'collision' });
    const proposals = gateway.evaluate({
      proposals: [
        { provider: 'openai', name: 'send_email', arguments: { to: 'a@example.com' }, permission: 'email.send' },
        { provider: 'gemini', name: 'send_email', arguments: { to: 'b@example.com' }, permission: 'email.send' },
      ],
      context: { permissions: ['email.send'] },
    });
    expect(proposals.approval_required).toHaveLength(2);
  });

  it('requires approval for mutations and denies missing permissions', () => {
    const gateway = createToolGateway({ sideEffectTools: ['send_email'] });
    const result = gateway.evaluate({
      proposals: [
        { provider: 'openai', name: 'send_email', arguments: {}, permission: 'email.send' },
        { provider: 'openai', name: 'read_doc', arguments: {}, permission: 'docs.read' },
      ],
      context: { permissions: ['email.send'] },
    });
    expect(result.approval_required).toHaveLength(1);
    expect(result.denied).toHaveLength(1);
  });
});

describe('ATLAS AI cost policy', () => {
  const basePolicy = {
    allowed_providers: ['atlas-local', 'openai', 'anthropic', 'gemini', 'codex-sovereign'],
    zero_cost_providers: ['atlas-local', 'gemini'],
    enforce_zero_cost: true,
    allow_paid_single: false,
    allow_council: false,
  };

  it('fails closed when no provider is selected', () => {
    expect(evaluateIntelligenceCostPolicy({ providers: [], policy: basePolicy }).decision).toBe('deny');
  });

  it('allows an explicitly permitted single paid provider', () => {
    const policy = { ...basePolicy, enforce_zero_cost: false, allow_paid_single: true };
    expect(evaluateIntelligenceCostPolicy({ mode: 'openai', providers: ['openai'], policy })).toMatchObject({ decision: 'allow' });
  });

  it('blocks paid council execution when zero-cost mode is enforced', () => {
    expect(evaluateIntelligenceCostPolicy({ mode: 'council', providers: ['openai', 'gemini'], policy: basePolicy })).toMatchObject({ decision: 'deny' });
  });

  it('allows a verified zero-cost provider without paid authorization', () => {
    expect(evaluateIntelligenceCostPolicy({ mode: 'gemini', providers: ['gemini'], policy: basePolicy })).toMatchObject({ decision: 'allow', estimated_automatic_cost_usd: 0 });
  });

  it('blocks a paid single provider before any model execution in zero-cost mode', () => {
    expect(evaluateIntelligenceCostPolicy({ mode: 'anthropic', providers: ['anthropic'], policy: basePolicy })).toMatchObject({ decision: 'deny', reason: 'paid_provider_blocked_by_zero_cost_policy' });
  });

  it('keeps emergency OpenAI fallback disabled until an explicit budget is configured', () => {
    expect(evaluateEmergencyFallbackPolicy({ provider: 'openai', policy: basePolicy })).toMatchObject({ decision: 'deny', reason: 'emergency_fallback_disabled' });
  });

  it('pre-authorizes only OpenAI emergency fallback when a positive budget and reservation exist', () => {
    const policy = { ...basePolicy, emergency_openai_enabled: true, emergency_openai_daily_budget_usd: 1, emergency_openai_reserve_usd: 0.1 };
    expect(evaluateEmergencyFallbackPolicy({ provider: 'openai', policy })).toMatchObject({ decision: 'allow', estimated_automatic_cost_usd: 0.1 });
    expect(evaluateEmergencyFallbackPolicy({ provider: 'anthropic', policy })).toMatchObject({ decision: 'deny', reason: 'emergency_provider_not_allowed' });
  });

  it('denies providers outside the server policy without substituting another provider', () => {
    expect(evaluateIntelligenceCostPolicy({ mode: 'bedrock', providers: ['bedrock'], policy: basePolicy })).toMatchObject({ decision: 'deny', reason: 'provider_not_allowed' });
  });
});
