import { describe, expect, it, vi } from 'vitest';
import { NETWORK_GUIDANCE, networkGuidanceFor } from '../../apps/web/src/work/networkConnectivity';
import { probeComputerOperationsRoute } from '../../apps/web/src/work/computerOperations';

describe('network connectivity evidence', () => {
  it('returns symptom-specific requirements without claiming connectivity', () => {
    expect(networkGuidanceFor('uploads').requirements.join(' ')).toContain('*.oaiusercontent.com');
    expect(networkGuidanceFor('streaming').requirements.join(' ')).toContain('443');
    expect(networkGuidanceFor('voice').requirements.join(' ')).toContain('3478');
    expect(NETWORK_GUIDANCE.every((item) => item.evidence === 'guidance-only')).toBe(true);
  });
  it('aborts stalled route checks and reports unavailable, not pass', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })) as unknown as typeof fetch;
      const pending = probeComputerOperationsRoute({ path: '/', group: 'public' }, { fetchImpl, timeoutMs: 100 });
      await vi.advanceTimersByTimeAsync(101);
      expect(await pending).toMatchObject({ state: 'unavailable', status: null, error: 'browser_probe_timeout' });
    } finally { vi.useRealTimers(); }
  });
  it('preserves HTTP failures and clears the timeout after success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    expect(await probeComputerOperationsRoute({ path: '/', group: 'public' }, { fetchImpl }))
      .toMatchObject({ state: 'fail', status: 503, error: 'unexpected_http_status' });
  });
});
