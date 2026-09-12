import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listCreatorProviders } from '../../apps/web/src/lib/creatorApi';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('atlas_access_token', 'test-token');
});

describe('ATLAS Creator browser API', () => {
  it('calls atlas-creator with bearer authentication', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, providers: [] }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    await listCreatorProviders();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/functions/v1/atlas-creator?api=providers');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-token');
  });
});
