import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearAtlasSession,
  getAccountingInsight,
  getLivePayablesLedger,
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

  it('loads live bills and vendor data from the same RLS-scoped organization', async () => {
    localStorage.setItem('atlas_access_token', 'live-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ org_id: 'org-1', role: 'owner', status: 'active' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          id: 'bill-1', org_id: 'org-1', vendor_id: 'vendor-1', bill_number: 'WAL-1', bill_date: '2026-08-20', due_date: null,
          amount: '18.99', balance_due: '18.99', approval_state: 'pending', match_state: 'no_po', status: 'open',
          created_at: '2026-08-20T00:00:00Z', updated_at: '2026-08-20T00:00:00Z'
        }
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 'vendor-1', name: 'Walgreens', email: null, phone: null, status: 'active' }
      ]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ledger = await getLivePayablesLedger();

    expect(ledger.source).toBe('supabase_rls_live');
    expect(ledger.organization).toEqual({ id: 'org-1', role: 'owner' });
    expect(ledger.bills).toHaveLength(1);
    expect(ledger.bills[0]).toMatchObject({
      bill_number: 'WAL-1',
      amount: 18.99,
      balance_due: 18.99,
      approval_state: 'pending',
      match_state: 'no_po',
      vendor: { name: 'Walgreens' }
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain('/rest/v1/accounting_bills');
    expect(String(fetchMock.mock.calls[2][0])).toContain('/rest/v1/vendors');
    expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>).authorization).toBe('Bearer live-token');
    expect((fetchMock.mock.calls[2][1]?.headers as Record<string, string>).authorization).toBe('Bearer live-token');
  });
});
