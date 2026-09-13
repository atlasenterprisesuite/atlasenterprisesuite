import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeOrchestrator } from '../../apps/web/src/modules/orchestrator/orchestratorClient';

afterEach(() => vi.restoreAllMocks());

describe('ATLAS Orchestrator readiness client', () => {
  it('fails closed when runtime URL is not configured', async () => {
    const result = await probeOrchestrator();
    expect(['unconfigured', 'unknown', 'unavailable']).toContain(result.state);
  });

  it('never returns healthy from an unverifiable response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ message: 'ok' }) })));
    const result = await probeOrchestrator();
    if (result.state !== 'unconfigured') expect(result.state).not.toBe('healthy');
  });
});
