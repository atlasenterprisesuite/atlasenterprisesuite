import { describe, expect, it } from 'vitest';
import { resolveConfiguredModels } from '../../supabase/functions/atlas-copilot/model-configuration.mjs';

const names = {
  shared: 'ATLAS_OPENAI_MODEL',
  fast: 'ATLAS_OPENAI_MODEL_FAST',
  balanced: 'ATLAS_OPENAI_MODEL_BALANCED',
  deep: 'ATLAS_OPENAI_MODEL_DEEP',
  legacyShared: 'ATLAS_OPENAI_ASTRA_MODEL',
};
function env(values: Record<string, string | undefined>) {
  return (name: string) => values[name];
}

describe('ATLAS PRO model configuration fail-closed contracts', () => {
  it('never invents a model when provider environment is empty', () => {
    expect(resolveConfiguredModels(env({}), names)).toEqual({ fast: null, balanced: null, deep: null });
  });

  it('treats whitespace and missing identifiers as unconfigured', () => {
    expect(resolveConfiguredModels(env({
      ATLAS_OPENAI_MODEL: '  ',
      ATLAS_OPENAI_MODEL_FAST: '',
      ATLAS_OPENAI_MODEL_BALANCED: ' ',
    }), names)).toEqual({ fast: null, balanced: null, deep: null });
  });

  it('uses an explicitly configured shared model only for its provider', () => {
    const config = resolveConfiguredModels(env({ ATLAS_OPENAI_MODEL: '  test-model-1  ' }), names);
    expect(config).toEqual({ fast: 'test-model-1', balanced: 'test-model-1', deep: 'test-model-1' });
  });

  it('honors profile overrides without substituting an unconfigured profile', () => {
    expect(resolveConfiguredModels(env({
      ATLAS_OPENAI_MODEL_FAST: 'test-fast',
      ATLAS_OPENAI_MODEL_DEEP: 'test-deep',
    }), names)).toEqual({ fast: 'test-fast', balanced: null, deep: 'test-deep' });
  });

  it('accepts the explicitly set legacy shared variable without inventing a default', () => {
    expect(resolveConfiguredModels(env({ ATLAS_OPENAI_ASTRA_MODEL: 'legacy-configured' }), names))
      .toEqual({ fast: 'legacy-configured', balanced: 'legacy-configured', deep: 'legacy-configured' });
  });

  it('gives explicit profile settings precedence over a shared setting', () => {
    expect(resolveConfiguredModels(env({
      ATLAS_OPENAI_MODEL: 'model-shared',
      ATLAS_OPENAI_MODEL_BALANCED: 'model-balanced',
    }), names)).toEqual({ fast: 'model-shared', balanced: 'model-balanced', deep: 'model-shared' });
  });

  it('isolates provider environment namespaces', () => {
    const foreign = resolveConfiguredModels(env({ ATLAS_OPENAI_MODEL: 'only-openai' }), {
      shared: 'ATLAS_GEMINI_MODEL',
      fast: 'ATLAS_GEMINI_MODEL_FAST',
      balanced: 'ATLAS_GEMINI_MODEL_BALANCED',
      deep: 'ATLAS_GEMINI_MODEL_DEEP',
    });
    expect(foreign).toEqual({ fast: null, balanced: null, deep: null });
  });
});
