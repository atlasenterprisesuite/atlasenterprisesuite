import { describe, expect, it } from 'vitest';
import { createProviderRegistry } from '../../supabase/functions/atlas-copilot/provider-registry.mjs';
import { createCouncilOrchestrator } from '../../supabase/functions/atlas-copilot/council-orchestrator.mjs';
import { createToolGateway } from '../../supabase/functions/atlas-copilot/tool-gateway.mjs';
import { evaluateEmergencyFallbackPolicy, evaluateIntelligenceCostPolicy } from '../../supabase/functions/atlas-copilot/cost-policy.mjs';

function adapter(id: 'atlas-local' | 'freellmapi' | 'openai' | 'bedrock' | 'gemini' | 'codex-sovereign', options: {
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
      ['freellmapi', 'configuration-required'],
      ['openai', 'verified'],
      ['bedrock', 'unavailable'],
      ['gemini', 'configuration-required'],
      ['codex-sovereign', 'unavailable'],
    ]);
    expect(JSON.stringify(readiness)).not.toContain('secret');
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
    const registry = createProviderRegistry({ providers: [adapter('openai', { text: 'A' }), adapter('gemini', { text: 'B' })] });
    const council = createCouncilOrchestrator({ registry });
    const result = await council.execute({
      providerIds: ['openai', 'gemini'],
      context: { organization_id: 'org-1', user_id: 'user-1' },
      route: { profile: 'balanced', capabilities: ['generation'] },
      instructions: 'ATLAS',
      input: [{ role: 'user', content: 'Compare.' }],
    });
    expect(result.provider).toBe('atlas-council');
    expect(result.contributions.map((item: any) => item.provider)).toEqual(['openai', 'gemini']);
    expect(result.text).toContain('OpenAI');
    expect(result.text).toContain('Gemini');
  });

  it('fails when fewer than two providers succeed', async () => {
    const registry = createProviderRegistry({ providers: [adapter('openai'), adapter('gemini', { fail: true })] });
    const council = createCouncilOrchestrator({ registry });
    await expect(council.execute({
      providerIds: ['openai', 'gemini'],
      context: { organization_id: 'org-1', user_id: 'user-1' },
      route: { profile: 'balanced', capabilities: ['generation'] },
      instructions: 'ATLAS',
      input: [],
    })).rejects.toMatchObject({ code: 'provider_unavailable' });
  });
});

describe('ATLAS Tool Gateway', () => {
  it('deduplicates identical side-effect proposals from multiple providers', () => {
    const gateway = createToolGateway();
    const evaluated = gateway.evaluate({
      context: { permissions: ['records.read'] },
      proposals: [
        { provider: 'openai', tool_name: 'records.lookup', arguments: { id: '1' }, risk_class: 'read-only', required_permissions: ['records.read'], side_effect: 'none', cost_class: 'none' },
        { provider: 'gemini', tool_name: 'records.lookup', arguments: { id: '1' }, risk_class: 'read-only', required_permissions: ['records.read'], side_effect: 'none', cost_class: 'none' },
      ],
    });
    expect(evaluated.accepted).toHaveLength(1);
    expect(evaluated.approval_required).toHaveLength(0);
  });

  it('does not deduplicate distinct proposals that collide in the audit hash', () => {
    const gateway = createToolGateway();
    const evaluated = gateway.evaluate({
      context: { permissions: [] },
      proposals: [
        { provider: 'openai', tool_name: 'tool_5aUgqoustr', arguments: {}, risk_class: 'read-only', required_permissions: [], side_effect: 'none', cost_class: 'none' },
        { provider: 'gemini', tool_name: 'tool_aQo4cTYVPs', arguments: {}, risk_class: 'read-only', required_permissions: [], side_effect: 'none', cost_class: 'none' },
      ],
    });
    expect(evaluated.accepted).toHaveLength(2);
    expect(evaluated.accepted[0].proposal_hash).toBe(evaluated.accepted[1].proposal_hash);
  });

  it('requires approval for mutations and denies missing permissions', () => {
    const gateway = createToolGateway();
    const evaluated = gateway.evaluate({
      context: { permissions: ['records.write'] },
      proposals: [
        { provider: 'openai', tool_name: 'records.update', arguments: { id: '1' }, risk_class: 'mutation', required_permissions: ['records.write'], side_effect: 'external', cost_class: 'none' },
        { provider: 'gemini', tool_name: 'payroll.run', arguments: {}, risk_class: 'mutation', required_permissions: ['payroll.run'], side_effect: 'external', cost_class: 'paid' },
      ],
    });
    expect(evaluated.approval_required.map((item: any) => item.tool_name)).toContain('records.update');
    expect(evaluated.denied.map((item: any) => item.tool_name)).toContain('payroll.run');
  });
});

describe('ATLAS AI cost policy', () => {
  it('fails closed when no provider is selected', () => {
    expect(evaluateIntelligenceCostPolicy({
      mode: 'auto',
      providers: [],
      policy: { enforce_zero_cost: true, zero_cost_providers: [] },
    })).toMatchObject({ decision: 'deny', reason: 'no_provider_selected' });
  });

  it('allows an explicitly permitted single paid provider', () => {
    expect(evaluateIntelligenceCostPolicy({
      mode: 'openai',
      providers: ['openai'],
      policy: { allowed_providers: ['openai'], allow_paid_single: true, allow_council: false, zero_cost_providers: [] },
    }).decision).toBe('allow');
  });

  it('blocks paid council execution when zero-cost mode is enforced', () => {
    expect(evaluateIntelligenceCostPolicy({
      mode: 'council',
      providers: ['openai', 'gemini'],
      policy: { allowed_providers: ['openai', 'gemini'], enforce_zero_cost: true, allow_paid_single: false, allow_council: false, zero_cost_providers: [] },
    })).toMatchObject({ decision: 'deny', reason: 'paid_provider_blocked_by_zero_cost_policy', estimated_automatic_cost_usd: 0 });
  });

  it('allows a verified zero-cost provider without paid authorization', () => {
    expect(evaluateIntelligenceCostPolicy({
      mode: 'auto',
      providers: ['atlas-local'],
      policy: { allowed_providers: ['atlas-local'], enforce_zero_cost: true, allow_paid_single: false, allow_council: false, zero_cost_providers: ['atlas-local'] },
    })).toMatchObject({ decision: 'allow', reason: 'zero_cost_provider', estimated_automatic_cost_usd: 0 });
  });

  it('blocks a paid single provider before any model execution in zero-cost mode', () => {
    expect(evaluateIntelligenceCostPolicy({
      mode: 'openai',
      providers: ['openai'],
      policy: { allowed_providers: ['openai'], enforce_zero_cost: true, allow_paid_single: false, allow_council: false, zero_cost_providers: [] },
    })).toMatchObject({ decision: 'deny', reason: 'paid_provider_blocked_by_zero_cost_policy', estimated_automatic_cost_usd: 0 });
  });

  it('keeps emergency OpenAI fallback disabled until an explicit budget is configured', () => {
    expect(evaluateEmergencyFallbackPolicy({
      provider: 'openai',
      policy: { allowed_providers: ['atlas-local', 'openai'], emergency_openai_enabled: false },
    })).toMatchObject({ decision: 'deny', reason: 'emergency_fallback_disabled' });

    expect(evaluateEmergencyFallbackPolicy({
      provider: 'openai',
      policy: { allowed_providers: ['atlas-local', 'openai'], emergency_openai_enabled: true, emergency_openai_daily_budget_usd: 0, emergency_openai_reserve_usd: 0 },
    })).toMatchObject({ decision: 'deny', reason: 'emergency_budget_not_configured' });
  });

  it('pre-authorizes only OpenAI emergency fallback when a positive budget and reservation exist', () => {
    expect(evaluateEmergencyFallbackPolicy({
      provider: 'openai',
      policy: { allowed_providers: ['atlas-local', 'openai'], emergency_openai_enabled: true, emergency_openai_daily_budget_usd: 5, emergency_openai_reserve_usd: 0.25 },
    })).toMatchObject({ decision: 'allow', reason: 'emergency_openai_pre_authorized', daily_budget_usd: 5, reserve_usd: 0.25 });

    expect(evaluateEmergencyFallbackPolicy({
      provider: 'gemini',
      policy: { allowed_providers: ['atlas-local', 'openai', 'gemini'], emergency_openai_enabled: true, emergency_openai_daily_budget_usd: 5, emergency_openai_reserve_usd: 0.25 },
    })).toMatchObject({ decision: 'deny', reason: 'emergency_provider_not_allowed' });
  });

  it('denies providers outside the server policy without substituting another provider', () => {
    expect(evaluateIntelligenceCostPolicy({
      mode: 'gemini',
      providers: ['gemini'],
      policy: { allowed_providers: ['openai'], allow_paid_single: true, allow_council: false, zero_cost_providers: [] },
    })).toMatchObject({ decision: 'deny', reason: 'provider_not_allowed' });
  });
});
