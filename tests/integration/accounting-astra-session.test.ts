import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearAtlasSession,
  getAccountingInsight,
  signInAtlas
} from '../../apps/web/src/lib/atlasSession';

afterEach(() => {
  clearAtlasSession();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ATLAS accounting Astra session bridge', () => {
  it('persists the same ATLAS access-token convention used by atlas-live', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'token-a', refresh_token: 'token-r' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await signInAtlas('operator@example.com', 'correct-horse-battery-staple');

    expect(localStorage.getItem('atlas_access_token')).toBe('token-a');
    expect(localStorage.getItem('atlas_refresh_token')).toBe('token-r');
  });

  it('scopes the insight request to the active organization and bearer session', async () => {
    localStorage.setItem('atlas_access_token', 'live-token');
    const insight = {
      ok: true,
      cached: false,
      model: 'gpt-6-astra',
      response_id: 'resp_test',
      generated_at: '2026-09-07T22:00:00.000Z',
      snapshot: { source: 'supabase_rls_live', bill_count: 2, open_balance: 58.98, chart_account_count: 5, counts: {} },
      analysis: '## Estado real\nDatos visibles.',
      execution: { payments: false, journal_entries: false, mutations: false }
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ org_id: 'org-1', role: 'owner', status: 'active' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(insight), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getAccountingInsight(false);

    expect(result.model).toBe('gpt-6-astra');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const orgCall = fetchMock.mock.calls[0];
    const insightCall = fetchMock.mock.calls[1];
    expect(String(orgCall[0])).toContain('/rest/v1/organization_members');
    expect((orgCall[1]?.headers as Record<string, string>).authorization).toBe('Bearer live-token');
    expect(String(insightCall[0])).toContain('/functions/v1/atlas-accounting-insights');
    expect((insightCall[1]?.headers as Record<string, string>).authorization).toBe('Bearer live-token');
    expect(JSON.parse(String(insightCall[1]?.body))).toEqual({ org_id: 'org-1', force_refresh: false });
  });
});
