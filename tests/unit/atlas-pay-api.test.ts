import { existsSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizedAtlasFetch: vi.fn(),
  getActiveAtlasOrganization: vi.fn()
}));

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  authorizedAtlasFetch: mocks.authorizedAtlasFetch,
  getActiveAtlasOrganization: mocks.getActiveAtlasOrganization
}));

const apiPath = 'apps/web/src/lib/payApi.ts';
const api = existsSync(apiPath) ? await import('../../apps/web/src/lib/payApi') : null;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('ATLAS Pay API tenant and truth boundaries', () => {
  beforeEach(() => {
    mocks.authorizedAtlasFetch.mockReset();
    mocks.getActiveAtlasOrganization.mockReset();
    mocks.getActiveAtlasOrganization.mockResolvedValue({ id: 'org-1', role: 'owner' });
  });

  it('loads accounts only for the active organization', async () => {
    expect(api).not.toBeNull();
    mocks.authorizedAtlasFetch.mockResolvedValue(response([{
      id: 'acct-1',
      org_id: 'org-1',
      provider: 'provider-a',
      provider_account_ref: 'opaque-ref',
      account_type: 'stored_value',
      country: 'US',
      currency: 'USD',
      status: 'provider_verified',
      display_name: 'USD account',
      masked_identifier: '•••• 1234',
      available_balance_minor: 145078,
      ledger_balance_minor: 145078,
      balance_as_of: '2026-09-29T15:00:00Z',
      metadata: {},
      created_at: '2026-09-29T10:00:00Z',
      updated_at: '2026-09-29T15:00:00Z'
    }]));

    const result = await api!.loadPayAccounts();
    const url = String(mocks.authorizedAtlasFetch.mock.calls[0][0]);
    expect(url).toContain('/rest/v1/pay_accounts?');
    expect(url).toContain('org_id=eq.org-1');
    expect(result.organizationId).toBe('org-1');
    expect(result.rows[0]).toMatchObject({ id: 'acct-1', orgId: 'org-1', currency: 'USD', availableBalanceMinor: 145078 });
  });

  it('re-resolves organization context on later reads', async () => {
    expect(api).not.toBeNull();
    mocks.authorizedAtlasFetch.mockResolvedValue(response([]));
    await api!.loadPayAccounts();
    mocks.getActiveAtlasOrganization.mockResolvedValue({ id: 'org-2', role: 'owner' });
    await api!.loadPayAccounts();
    expect(String(mocks.authorizedAtlasFetch.mock.calls[0][0])).toContain('org_id=eq.org-1');
    expect(String(mocks.authorizedAtlasFetch.mock.calls[1][0])).toContain('org_id=eq.org-2');
  });

  it('scopes account detail by both organization and opaque id', async () => {
    expect(api).not.toBeNull();
    mocks.authorizedAtlasFetch.mockResolvedValue(response([]));
    const result = await api!.loadPayAccount('acct opaque/1');
    const url = String(mocks.authorizedAtlasFetch.mock.calls[0][0]);
    expect(url).toContain('org_id=eq.org-1');
    expect(url).toContain('id=eq.acct+opaque%2F1');
    expect(result).toBeNull();
  });

  it('applies only supported activity filters', async () => {
    expect(api).not.toBeNull();
    mocks.authorizedAtlasFetch.mockResolvedValue(response([]));
    await api!.loadPayActivity({
      status: 'posted',
      currency: 'USD',
      accountId: 'acct-1',
      activityType: 'payment',
      startDate: '2026-09-01',
      endDate: '2026-09-29'
    });
    const url = String(mocks.authorizedAtlasFetch.mock.calls[0][0]);
    expect(url).toContain('org_id=eq.org-1');
    expect(url).toContain('status=eq.posted');
    expect(url).toContain('currency=eq.USD');
    expect(url).toContain('account_id=eq.acct-1');
    expect(url).toContain('activity_type=eq.payment');
    expect(url).toContain('occurred_at=gte.2026-09-01');
    expect(url).toContain('occurred_at=lte.2026-09-29');
  });

  it('returns an explicit unavailable state on table failure without sample rows', async () => {
    expect(api).not.toBeNull();
    mocks.authorizedAtlasFetch.mockResolvedValue(response({ message: 'missing table' }, 503));
    const result = await api!.loadPayAccounts();
    expect(result.available).toBe(false);
    expect(result.rows).toEqual([]);
    expect(result.error).toBe('HTTP 503');
    expect(result.source).toBe('supabase_rls_live');
  });
});
