import { describe, expect, it, vi } from 'vitest';
import { createBinanceUsReadAdapter, type ServerReadDecision } from '../../packages/pay/src/binanceUsReadAdapter';
const decision: ServerReadDecision = { sessionOrganizationId: 'org-a', connectionOrganizationId: 'org-a', hasPayReadPermission: true, effectiveKeyPermissionsVerifiedReadOnly: true };
const account = { canTrade: false, canWithdraw: false, balances: [{ asset: 'BTC', free: '0.00000001', locked: '0.00000000' }] };
const make = (resolve: () => Promise<ServerReadDecision>, transport = vi.fn(async (): Promise<unknown> => account)) =>
  { const adapter = createBinanceUsReadAdapter(transport, resolve); return { adapter, transport }; };
describe('Binance.US isolated read adapter', () => {
  it('denies missing permission and cross-tenant session before transport', async () => {
    for (const d of [{ ...decision, hasPayReadPermission: false }, { ...decision, sessionOrganizationId: 'org-b' }]) {
      const { adapter, transport } = make(async () => d);
      await expect(adapter.readBalances()).rejects.toThrow(d.hasPayReadPermission ? 'TENANT_MISMATCH' : 'ACCESS_DENIED');
      expect(transport).not.toHaveBeenCalled();
    }
  });
  it('rejects unverified key permissions and resolver errors before transport', async () => {
    const { adapter, transport } = make(async () => ({ ...decision, effectiveKeyPermissionsVerifiedReadOnly: false }));
    await expect(adapter.readBalances()).rejects.toThrow('KEY_PERMISSIONS_UNVERIFIED');
    expect(transport).not.toHaveBeenCalled();
    await expect(make(async () => { throw new Error('session failure'); }).adapter.readBalances()).rejects.toThrow('ACCESS_DENIED');
  });
  it('does not accept client-provided authorization arguments', async () => {
    const { adapter, transport } = make(async () => ({ ...decision, hasPayReadPermission: false }));
    await expect((adapter.readBalances as (...args: unknown[]) => Promise<unknown>)({ authorized: true, boundOrganizationId: 'org-a', permissionEvidence: 'read_only_verified' })).rejects.toThrow('ACCESS_DENIED');
    expect(transport).not.toHaveBeenCalled();
  });
  it('preserves precision and invokes only the injected read path', async () => {
    const { adapter, transport } = make(async () => decision);
    expect((await adapter.readBalances()).balances[0].free).toBe('0.00000001');
    expect(transport).toHaveBeenCalledWith('/api/v3/account');
  });
  it('rejects unsafe capabilities, malformed data and provider failures', async () => {
    await expect(make(async () => decision, vi.fn(async () => ({ ...account, canTrade: true }))).adapter.readBalances()).rejects.toThrow('ACCOUNT_CAPABILITY_UNSAFE');
    await expect(make(async () => decision, vi.fn(async () => ({ ...account, balances: [{ asset: 'BTC', free: 0.1, locked: '0' }] }))).adapter.readBalances()).rejects.toThrow('INVALID_PROVIDER_RESPONSE');
    await expect(make(async () => decision, vi.fn(async (): Promise<unknown> => { throw new Error('timeout'); })).adapter.readBalances()).rejects.toThrow('PROVIDER_UNAVAILABLE');
  });
  it('deduplicates identical evidence and rejects contradictory events', () => {
    const { adapter } = make(async () => decision);
    const event = { id: 'trade-1', asset: 'BTC', quantity: '0.00000001' };
    expect(adapter.reconcile([event, event])).toEqual([event]);
    expect(() => adapter.reconcile([event, { ...event, quantity: '0.00000002' }])).toThrow('RECONCILIATION_CONFLICT');
  });
});
