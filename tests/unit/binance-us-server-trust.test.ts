import { describe, expect, it, vi } from 'vitest';
import { createBinanceUsServerReadDecisionResolver } from '../../packages/pay/src/binanceUsServerTrust';
import { createBinanceUsReadAdapter } from '../../packages/pay/src/binanceUsReadAdapter';
function fixture() {
  const deps = {
    authenticate: vi.fn(async () => ({ userId: 'user-a' })),
    loadConnection: vi.fn(async () => ({ organizationId: 'org-a', state: 'authorized' as const })),
    verifyMembershipAndPermission: vi.fn(async () => true),
    verifyEffectiveReadOnlyKeyPermissions: vi.fn(async () => true)
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
