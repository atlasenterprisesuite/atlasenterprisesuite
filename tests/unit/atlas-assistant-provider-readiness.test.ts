import { describe, expect, it } from 'vitest';
import {
  assistantProviderSummary,
  hasVerifiedAssistantProvider,
  type AssistantStatusResponse
} from '../../apps/web/src/assistant/client';

function status(overrides: Partial<AssistantStatusResponse> = {}): AssistantStatusResponse {
  return {
    ok: true,
    authenticated: true,
    provider: 'openai',
    provider_state: 'not_configured',
    model: null,
    storage_state: 'configured',
    organization: 'org-1',
    role: 'owner',
    capabilities: ['generation', 'reasoning'],
    providers: [],
    ...overrides
  };
}

describe('ATLAS Assistant provider readiness', () => {
  it('accepts Gemini as ready when OpenAI is not configured', () => {
    const value = status({
      providers: [
        { id: 'openai', state: 'configuration-required', configured: false, verified: false, model: null, capabilities: ['generation'], profiles: ['balanced'], error: 'provider_not_configured' },
        { id: 'gemini', state: 'verified', configured: true, verified: true, model: 'gemini-live', capabilities: ['generation', 'reasoning'], profiles: ['balanced'], error: null }
      ]
    });

    expect(hasVerifiedAssistantProvider(value)).toBe(true);
    expect(assistantProviderSummary(value)).toBe('gemini');
  });

  it('reports no verified provider when every provider requires configuration', () => {
    const value = status({
      providers: [
        { id: 'openai', state: 'configuration-required', configured: false, verified: false, model: null, capabilities: [], profiles: [], error: 'provider_not_configured' },
        { id: 'gemini', state: 'configuration-required', configured: false, verified: false, model: null, capabilities: [], profiles: [], error: 'provider_not_configured' }
      ]
    });

    expect(hasVerifiedAssistantProvider(value)).toBe(false);
    expect(assistantProviderSummary(value)).toBe('no verified provider');
  });
});
