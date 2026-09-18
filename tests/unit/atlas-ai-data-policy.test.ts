import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AI_DATA_POLICY,
  isSensitiveAiModule,
  normalizeAiDataPolicy,
  shouldStoreProviderResponse
} from '../../supabase/functions/atlas-copilot/ai-data-policy.mjs';

describe('ATLAS AI data policy', () => {
  it('fails closed by default', () => {
    expect(DEFAULT_AI_DATA_POLICY.provider_call_logging_mode).toBe('disabled');
    expect(shouldStoreProviderResponse({ module: 'assistant' })).toBe(false);
  });

  it('never allows provider storage for sensitive modules', () => {
    const policy = { provider_call_logging_mode: 'all', selected_modules: [] };
    for (const module of ['health', 'health/research', 'atlas-health', 'payroll', 'finance/accounting', 'lawyer']) {
      expect(isSensitiveAiModule(module)).toBe(true);
      expect(shouldStoreProviderResponse({ policy, module, perCallStore: true })).toBe(false);
    }
  });

  it('honors explicit per-call storage only for non-sensitive modules', () => {
    const policy = { provider_call_logging_mode: 'per_call', selected_modules: [] };
    expect(shouldStoreProviderResponse({ policy, module: 'assistant', perCallStore: true })).toBe(true);
    expect(shouldStoreProviderResponse({ policy, module: 'assistant', perCallStore: false })).toBe(false);
    expect(shouldStoreProviderResponse({ policy, module: 'assistant' })).toBe(false);
  });

  it('limits selected-module mode to the configured allowlist', () => {
    const policy = normalizeAiDataPolicy({
      provider_call_logging_mode: 'selected_modules',
      selected_modules: ['assistant', 'studio', 'health']
    });
    expect(policy.selected_modules).toEqual(['assistant', 'studio']);
    expect(shouldStoreProviderResponse({ policy, module: 'assistant' })).toBe(true);
    expect(shouldStoreProviderResponse({ policy, module: 'commerce' })).toBe(false);
    expect(shouldStoreProviderResponse({ policy, module: 'health' })).toBe(false);
  });

  it('supports all only for non-sensitive modules and rejects unknown modes', () => {
    expect(shouldStoreProviderResponse({ policy: { provider_call_logging_mode: 'all' }, module: 'studio' })).toBe(true);
    expect(shouldStoreProviderResponse({ policy: { provider_call_logging_mode: 'unexpected' }, module: 'studio' })).toBe(false);
  });
});
