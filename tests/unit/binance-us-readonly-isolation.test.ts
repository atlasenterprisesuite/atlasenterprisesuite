import { describe, expect, it, vi } from 'vitest';
import { createBinanceUsReadAdapter } from '../../packages/pay/src/binanceUsReadAdapter';

const scope = { organizationId: 'org-a', boundOrganizationId: 'org-a', authorized: true, permissionEvidence: 'read_only_verified' as const };
const account = { canTrade: false, canWithdraw: false, balances: [{ asset: 'BTC', free: '0.00000001', locked: '0.00000000' }] };

describe('Binance.US read-only isolation', () => {
  it('denies absent authorization and cross-tenant access without invoking transport', async () => {
    const transport = vi.fn(async () => account);
    const adapter = createBinanceUsReadAdapter(transport);
    await expect(adapter.readBalances({ ...scope, authorized: false })).rejects.toThrow('ACCESS_DENIED');
    await expect(adapter.readBalances({ ...scope, organizationId: 'org-b' })).rejects.toThrow('TENANT_MISMATCH');
    expect(transport).not.toHaveBeenCalled();
  });
  it('denies excessive or unverified API key permissions', async () => {
    const transport = vi.fn(async () => account);
    const adapter = createBinanceUsReadAdapter(transport);
    await expect(adapter.readBalances({ ...scope, permissionEvidence: 'unknown' })).rejects.toThrow('KEY_PERMISSIONS_UNVERIFIED');
    await expect(adapter.readBalances({ ...scope, permissionEvidence: 'trade_enabled' })).rejects.toThrow('KEY_PERMISSIONS_UNVERIFIED');
    expect(transport).not.toHaveBeenCalled();
  });
  it('preserves exact decimal strings and never invokes a write method', async () => {
    const transport = vi.fn(async () => account);
    const result = await createBinanceUsReadAdapter(transport).readBalances(scope);
    expect(result.balances[0].free).toBe('0.00000001');
    expect(transport).toHaveBeenCalledWith('/api/v3/account');
  });
  it('fails closed on malformed balances, capability mismatch and provider errors', async () => {
    await expect(createBinanceUsReadAdapter(async () => ({ ...account, canTrade: true })).readBalances(scope)).rejects.toThrow('ACCOUNT_CAPABILITY_UNSAFE');
    await expect(createBinanceUsReadAdapter(async () => ({ ...account, balances: [{ asset: 'BTC', free: 0.1, locked: '0' }] })).readBalances(scope)).rejects.toThrow('INVALID_PROVIDER_RESPONSE');
    await expect(createBinanceUsReadAdapter(async () => { throw new Error('timeout'); }).readBalances(scope)).rejects.toThrow('PROVIDER_UNAVAILABLE');
  });
  it('deduplicates identical provider events and rejects contradictory duplicates', () => {
    const adapter = createBinanceUsReadAdapter(async () => account);
    const event = { id: 'trade-1', asset: 'BTC', quantity: '0.00000001' };
    expect(adapter.reconcile([event, event])).toEqual([event]);
    expect(() => adapter.reconcile([event, { ...event, quantity: '0.00000002' }])).toThrow('RECONCILIATION_CONFLICT');
  });
});
