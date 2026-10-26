/**
 * Binance.US isolated read model. The injected transport MUST be an authenticated
 * server-side GET-only transport; this module never signs requests or holds keys.
 * No live provider wiring, persistence, trading, or payout capability.
 */
export type BinanceReadScope = {
  organizationId: string;
  boundOrganizationId: string;
  authorized: boolean;
  permissionEvidence: 'read_only_verified' | 'unknown' | 'trade_enabled' | 'withdraw_enabled';
};
export type BinanceBalance = { asset: string; free: string; locked: string };
export type BinanceTradeEvidence = { id: string; asset: string; quantity: string };
export type BinanceReadTransport = (path: '/api/v3/account') => Promise<unknown>;

const decimal = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
function validBalance(value: unknown): value is BinanceBalance {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.asset === 'string' && /^[A-Z0-9]{2,20}$/.test(row.asset)
    && typeof row.free === 'string' && decimal.test(row.free)
    && typeof row.locked === 'string' && decimal.test(row.locked);
}
function validateScope(scope: BinanceReadScope): void {
  if (!scope.authorized) throw new Error('ACCESS_DENIED');
  if (!scope.organizationId || !scope.boundOrganizationId || scope.organizationId !== scope.boundOrganizationId)
    throw new Error('TENANT_MISMATCH');
  if (scope.permissionEvidence !== 'read_only_verified') throw new Error('KEY_PERMISSIONS_UNVERIFIED');
}
export function createBinanceUsReadAdapter(transport: BinanceReadTransport) {
  return {
    async readBalances(scope: BinanceReadScope): Promise<{ balances: BinanceBalance[] }> {
      validateScope(scope);
      let response: unknown;
      try { response = await transport('/api/v3/account'); }
      catch { throw new Error('PROVIDER_UNAVAILABLE'); }
      if (!response || typeof response !== 'object') throw new Error('INVALID_PROVIDER_RESPONSE');
      const account = response as Record<string, unknown>;
      if (account.canTrade !== false || account.canWithdraw !== false) throw new Error('ACCOUNT_CAPABILITY_UNSAFE');
      if (!Array.isArray(account.balances) || !account.balances.every(validBalance))
        throw new Error('INVALID_PROVIDER_RESPONSE');
      return { balances: account.balances.map((row: BinanceBalance) => ({ ...row })) };
    },
    reconcile(events: readonly BinanceTradeEvidence[]): BinanceTradeEvidence[] {
      const seen = new Map<string, BinanceTradeEvidence>();
      for (const event of events) {
        if (!event.id || !/^[A-Z0-9]{2,20}$/.test(event.asset) || !decimal.test(event.quantity))
          throw new Error('INVALID_PROVIDER_RESPONSE');
        const prior = seen.get(event.id);
        if (prior && (prior.asset !== event.asset || prior.quantity !== event.quantity))
          throw new Error('RECONCILIATION_CONFLICT');
        if (!prior) seen.set(event.id, { ...event });
      }
      return [...seen.values()];
    }
  };
}
