import { describe, expect, it, vi } from 'vitest';
import { createProviderRegistry } from '../../supabase/functions/atlas-copilot/provider-registry.mjs';

const profile = 'balanced';
function adapter({ configured = true, models = { fast: null, balanced: 'synthetic-model', deep: null }, probe } = {}) {
  return {
    descriptor: () => ({
      id: 'openai', configured, profiles: ['fast', 'balanced', 'deep'],
      capabilities: ['generation', 'reasoning'], models,
    }),
    probe: vi.fn(probe ?? (async () => ({ configured: true, verified: true, model: 'synthetic-model' }))),
  };
}
async function openaiState(value: ReturnType<typeof adapter>) {
  const registry = createProviderRegistry({ providers: [value] });
  const states = await registry.readiness({ profile });
  return states.find((state: { id: string }) => state.id === 'openai');
}

describe('ATLAS PRO model registry readiness P0 contracts', () => {
  it('never probes a provider with no configured model identifier', async () => {
    const value = adapter({ models: { fast: null, balanced: null, deep: null } });
    const state = await openaiState(value);
    expect(value.probe).not.toHaveBeenCalled();
    expect(state).toMatchObject({ configured: false, verified: false, state: 'configuration-required', model: null });
  });

  it('does not borrow a model configured for a different profile', async () => {
    const value = adapter({ models: { fast: 'fast-only', balanced: null, deep: null } });
    const state = await openaiState(value);
    expect(value.probe).not.toHaveBeenCalled();
    expect(state).toMatchObject({ configured: false, verified: false, state: 'configuration-required' });
  });

  it('does not bypass an empty profile with a generic model fallback', async () => {
    const value = adapter({ models: { fast: 'fast-only', balanced: null, deep: null } });
    const originalDescriptor = value.descriptor;
    value.descriptor = () => ({ ...originalDescriptor(), model: 'other-profile-default' });
    const state = await openaiState(value);
    expect(value.probe).not.toHaveBeenCalled();
    expect(state).toMatchObject({ configured: false, verified: false, state: 'configuration-required' });
  });

  it('never borrows a generic model when a profile-specific model map exists', async () => {
    const probe = vi.fn(async () => ({ configured: true, verified: true, model: 'generic-model' }));
    const value = {
      descriptor: () => ({
        id: 'openai', configured: true,
        profiles: ['fast', 'balanced', 'deep'], capabilities: ['generation'],
        models: { fast: 'fast-only', balanced: null, deep: null },
        model: 'generic-model',
      }),
      probe,
    };
    const states = await createProviderRegistry({ providers: [value] }).readiness({ profile: 'balanced' });
    expect(probe).not.toHaveBeenCalled();
    expect(states.find((item: { id: string }) => item.id === 'openai'))
      .toMatchObject({ configured: false, verified: false, state: 'configuration-required', model: null });
  });

  it('does not accept a fabricated verified response for an unconfigured adapter', async () => {
    const value = adapter({ configured: false });
    const state = await openaiState(value);
    expect(value.probe).not.toHaveBeenCalled();
    expect(state).toMatchObject({ configured: false, verified: false, state: 'configuration-required' });
  });

  it('rejects verification for a different model name', async () => {
    const value = adapter({ probe: async () => ({
      configured: true, verified: true, model: 'unrequested-model',
    }) });
    expect(await openaiState(value)).toMatchObject({
      configured: true, verified: false, state: 'configured-unverified',
      model: 'synthetic-model', error: 'provider_verification_required',
    });
  });

  it('normalizes provider error strings without exposing raw details', async () => {
    const syntheticSecret = 'synthetic-example-not-a-credential';
    const value = adapter({ probe: async () => ({
      configured: true, verified: false, model: 'synthetic-model', error: syntheticSecret,
    }) });
    const state = await openaiState(value);
    expect(state).toMatchObject({ verified: false, error: 'provider_unavailable' });
    expect(JSON.stringify(state)).not.toContain(syntheticSecret);
  });

  it('reports verified only when the configured model and probe agree', async () => {
    const value = adapter();
    const state = await openaiState(value);
    expect(value.probe).toHaveBeenCalledWith({ profile: 'balanced' });
    expect(state).toMatchObject({
      configured: true, verified: true, state: 'verified',
      model: 'synthetic-model', error: null,
    });
  });
});
