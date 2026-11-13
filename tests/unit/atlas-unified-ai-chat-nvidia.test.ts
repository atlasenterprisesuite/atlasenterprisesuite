import { describe, expect, it, vi } from 'vitest';
import { createOpenAICompatibleChatAdapter } from '../../supabase/functions/atlas-copilot/openai-compatible-chat-adapter.mjs';
import { createIntelligenceRouter } from '../../supabase/functions/atlas-copilot/intelligence-gateway.mjs';
import { evaluateIntelligenceCostPolicy } from '../../supabase/functions/atlas-copilot/cost-policy.mjs';

const baseUrl = 'https://integrate.api.nvidia.com/v1';
const models = { fast: 'nvidia/selected-fast', balanced: 'nvidia/selected-balanced', deep: 'nvidia/selected-deep' };

describe('NVIDIA NIM pilot — fail-closed provider contract', () => {
  it('does not call NVIDIA or advertise readiness without server-side API credentials', async () => {
    const fetchFn = vi.fn();
    const adapter = createOpenAICompatibleChatAdapter({ id: 'nvidia', apiKey: '', baseUrl, models, backend: 'nvidia-nim', fetchFn });
    expect(adapter.descriptor()).toMatchObject({ id: 'nvidia', configured: false });
    await expect(adapter.probe({ profile: 'balanced' })).resolves.toMatchObject({ verified: false, error: 'provider_not_configured' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('authenticates a configured model using mocked NIM endpoints without paid API calls', async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-key');
      if (url.endsWith('/models')) return new Response(JSON.stringify({ data: [{ id: models.balanced }] }), { status: 200 });
      expect(url).toBe(baseUrl + '/chat/completions');
      const payload = JSON.parse(String(init?.body));
      expect(payload).toMatchObject({ model: models.balanced, max_tokens: 300, stream: false });
      expect(payload.messages).toEqual([{ role: 'system', content: 'Use ATLAS governance.' }, { role: 'user', content: 'Hello' }]);
      return new Response(JSON.stringify({ id: 'chat-mock-1', model: models.balanced, choices: [{ message: { content: 'Hello from NVIDIA mock' } }], usage: { total_tokens: 12 } }), { status: 200 });
    });
    const adapter = createOpenAICompatibleChatAdapter({ id: 'nvidia', apiKey: 'test-key', baseUrl, models, backend: 'nvidia-nim', fetchFn });
    await expect(adapter.probe({ profile: 'balanced' })).resolves.toMatchObject({ configured: true, verified: true });
    await expect(adapter.execute({ route: { profile: 'balanced', capabilities: ['generation'] }, instructions: 'Use ATLAS governance.', input: [{ role: 'user', content: 'Hello' }], max_output_tokens: 300 })).resolves.toMatchObject({ provider: 'nvidia', text: 'Hello from NVIDIA mock' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('blocks unverified models and never silently falls back from an explicit NVIDIA route', async () => {
    const adapter = createOpenAICompatibleChatAdapter({ id: 'nvidia', apiKey: 'test-key', baseUrl, models, fetchFn: vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'another-model' }] }), { status: 200 })) });
    const probe = await adapter.probe({ profile: 'balanced' });
    expect(probe).toMatchObject({ verified: false, error: 'provider_verification_required' });
    const router = createIntelligenceRouter({ providers: [{ id: 'nvidia', configured: true, verified: probe.verified, capabilities: ['generation','reasoning'], profiles: ['fast','balanced','deep'] }, { id: 'atlas-local', configured: true, verified: true, capabilities: ['generation'], profiles: ['balanced'] }] });
    expect(() => router.route({ mode: 'nvidia', intent: 'balanced', capabilities_requested: ['generation'] })).toThrowError(/provider_unavailable/);
  });

  it('does not bypass ATLAS zero-cost policy', () => {
    const decision = evaluateIntelligenceCostPolicy({ mode: 'nvidia', providers: ['nvidia'], policy: { enforce_zero_cost: true, zero_cost_providers: ['atlas-local'], allow_paid_single: false, allow_council: false, allowed_providers: [] } });
    expect(decision.decision).toBe('deny');
    expect(decision.reason).toBe('paid_provider_blocked_by_zero_cost_policy');
  });
});
