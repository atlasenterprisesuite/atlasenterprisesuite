import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { unavailableAssistantRouteError } from '../../apps/web/src/modules/intelligence/assistantSubmissionState';
import type { AssistantStatusResponse } from '../../apps/web/src/assistant/client';

const status = (overrides: Partial<AssistantStatusResponse> = {}) => ({
  cost_policy: { allow_council: false, enforce_zero_cost: true },
  providers: [
    { id: 'atlas-local', state: 'verified', verified: true, configured: true },
    { id: 'gemini', state: 'configuration-required', verified: false, configured: false },
    { id: 'openai', state: 'unavailable', verified: false, configured: true }
  ],
  ...overrides
} as AssistantStatusResponse);

describe('ATLAS AI unavailable route feedback', () => {
  it('reports unavailability before status is loaded', () => {
    expect(unavailableAssistantRouteError('auto', null)).toBe('status_unavailable');
  });

  it('does not silently ignore submissions with no valid automatic provider', () => {
    expect(unavailableAssistantRouteError('auto', status())).toBe('no_provider_selected');
  });

  it('explains provider configuration and runtime unavailability separately', () => {
    expect(unavailableAssistantRouteError('gemini', status())).toBe('provider_not_configured');
    expect(unavailableAssistantRouteError('openai', status())).toBe('provider_unavailable');
  });

  it('keeps zero-cost Council restrictions explicit', () => {
    expect(unavailableAssistantRouteError('council', status())).toBe('paid_provider_blocked_by_zero_cost_policy');
    expect(unavailableAssistantRouteError('council', status({ cost_policy: { allow_council: true } }))).toBe('no_provider_selected');
  });

  it('leaves the Send control actionable and blocks network calls when the route is unverified', () => {
    const source = readFileSync('apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx', 'utf8');
    expect(source).toContain('setError(unavailableAssistantRouteError(mode, status));');
    expect(source).toContain('disabled={busy || conversationTranslatorEnabled || !prompt.trim()}');
    expect(source).not.toContain('disabled={busy || conversationTranslatorEnabled || !routeReady || !prompt.trim()}');
    expect(source).toContain("if (!routeReady) {\n      setError(unavailableAssistantRouteError(mode, status));\n      return;\n    }");
  });
});
