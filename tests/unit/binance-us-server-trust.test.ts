import { describe, expect, it, vi } from 'vitest';
import { createBinanceUsServerReadDecisionResolver } from '../../packages/pay/src/binanceUsServerTrust';
import { createBinanceUsReadAdapter } from '../../packages/pay/src/binanceUsReadAdapter';
function fixture() {
  const deps = {
    authenticate: vi.fn(async (): Promise<{ userId: string; organizationId: string } | null> => ({ userId: 'user-a', organizationId: 'org-a' })),
    loadConnection: vi.fn(async () => ({ organizationId: 'org-a', state: 'authorized' as const })),
    verifyMembershipAndPermission: vi.fn(async (): Promise<boolean> => true),
    verifyEffectiveReadOnlyKeyPermissions: vi.fn(async (): Promise<boolean> => true)
  };
  const transport = vi.fn(async () => ({ canTrade: false, canWithdraw: false, balances: [] }));
  const adapter = createBinanceUsReadAdapter(transport, createBinanceUsServerReadDecisionResolver(deps));
  return { deps, transport, adapter };
}
describe('Binance.US server-only trust resolver contract', () => {
  it('allows read only after server session, permission and key gates', async () => {
    const f = fixture();
    expect(await f.adapter.readBalances()).toEqual({ balances: [] });
    expect(f.deps.verifyMembershipAndPermission).toHaveBeenCalledWith('user-a', 'org-a', 'pay.read');
    expect(f.transport).toHaveBeenCalledTimes(1);
  });
  it('rejects cross-tenant connection even if permission callback incorrectly allows it', async () => {
    const f = fixture();
    f.deps.loadConnection.mockResolvedValue({ organizationId: 'org-b', state: 'authorized' });
    f.deps.verifyMembershipAndPermission.mockResolvedValue(true);
    await expect(f.adapter.readBalances()).rejects.toThrow('ACCESS_DENIED');
    expect(f.transport).not.toHaveBeenCalled();
  });
  it('rejects an authenticated session without trusted organization scope', async () => {
    const f = fixture();
    f.deps.authenticate.mockResolvedValue({ userId: 'user-a' } as never);
    await expect(f.adapter.readBalances()).rejects.toThrow('ACCESS_DENIED');
    expect(f.transport).not.toHaveBeenCalled();
  });
  it('rejects missing authenticated identity before transport', async () => {
    const f = fixture();
    f.deps.authenticate.mockResolvedValue(null as never);
    await expect(f.adapter.readBalances()).rejects.toThrow('ACCESS_DENIED');
    expect(f.transport).not.toHaveBeenCalled();
  });
  it('rejects denied pay.read membership', async () => {
    const f = fixture();
    f.deps.verifyMembershipAndPermission.mockResolvedValue(false);
    await expect(f.adapter.readBalances()).rejects.toThrow('ACCESS_DENIED');
    expect(f.transport).not.toHaveBeenCalled();
  });
  it('rejects revoked and unverified connections', async () => {
    for (const state of ['revoked', 'blocked', 'unverified']) {
      const f = fixture();
      f.deps.loadConnection.mockResolvedValue({ organizationId: 'org-a', state } as never);
      await expect(f.adapter.readBalances()).rejects.toThrow('ACCESS_DENIED');
      expect(f.transport).not.toHaveBeenCalled();
    }
  });
  it('rejects a cross-tenant connection even with a valid session', async () => {
    const f = fixture();
    f.deps.loadConnection.mockResolvedValue({ organizationId: 'org-b', state: 'authorized' });
    f.deps.verifyMembershipAndPermission.mockImplementation(async (_user, org) => org === 'org-a');
    await expect(f.adapter.readBalances()).rejects.toThrow('ACCESS_DENIED');
    expect(f.deps.verifyMembershipAndPermission).not.toHaveBeenCalled();
    expect(f.deps.verifyEffectiveReadOnlyKeyPermissions).not.toHaveBeenCalled();
    expect(f.transport).not.toHaveBeenCalled();
  });
  it('blocks reads immediately after connection revocation', async () => {
    const f = fixture();
    await expect(f.adapter.readBalances()).resolves.toEqual({ balances: [] });
    f.deps.loadConnection.mockResolvedValue({ organizationId: 'org-a', state: 'revoked' } as never);
    await expect(f.adapter.readBalances()).rejects.toThrow('ACCESS_DENIED');
    expect(f.transport).toHaveBeenCalledTimes(1);
  });
  it('rejects unverified key permission evidence', async () => {
    const f = fixture();
    f.deps.verifyEffectiveReadOnlyKeyPermissions.mockResolvedValue(false);
    await expect(f.adapter.readBalances()).rejects.toThrow('ACCESS_DENIED');
    expect(f.transport).not.toHaveBeenCalled();
  });
  it('does not trust forged HTTP-like arguments', async () => {
    const f = fixture();
    f.deps.verifyMembershipAndPermission.mockResolvedValue(false);
    await expect((f.adapter.readBalances as (...args: unknown[]) => Promise<unknown>)({ userId: 'admin', organizationId: 'org-b', payRead: true })).rejects.toThrow('ACCESS_DENIED');
    expect(f.deps.verifyMembershipAndPermission).toHaveBeenCalledWith('user-a', 'org-a', 'pay.read');
  });
  it('fails closed if the server trust source throws', async () => {
    const f = fixture();
    f.deps.authenticate.mockRejectedValue(new Error('server offline'));
    await expect(f.adapter.readBalances()).rejects.toThrow('ACCESS_DENIED');
    expect(f.transport).not.toHaveBeenCalled();
  });
});
