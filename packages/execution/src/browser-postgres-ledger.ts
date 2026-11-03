/**
 * ATLAS Sovereign Browser: transaction-bound internal database port.
 * Never expose this port to browser clients or PostgREST. The caller supplies a
 * trusted, pre-authenticated PostgreSQL transaction, NOT a service_role REST client.
 * Database SQL functions are the final authority on membership and scope.
 */
export type BrowserScope = Readonly<{
  organizationId: string;
  tenantId: string;
  idempotencyKey: string;
  workflowId: string;
  stepId: string;
  actionDigest: string;
}>;

export interface TrustedBrowserTransaction {
  /** Identity must already be bound by the database connection/transaction. */
  readonly authenticatedActorId: string;
  query<T>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }>;
}

export interface TrustedBrowserDatabase {
  /** Must BEGIN, set a verified DB identity, and COMMIT or ROLLBACK atomically. */
  transaction<T>(run: (tx: TrustedBrowserTransaction) => Promise<T>): Promise<T>;
}

function required(value: string, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('browser_invalid_' + field);
  return value;
}

function scopeParams(scope: BrowserScope) {
  return [
    required(scope.organizationId, 'organization'),
    required(scope.tenantId, 'tenant'),
    required(scope.idempotencyKey, 'key'),
    required(scope.workflowId, 'workflow'),
    required(scope.stepId, 'step'),
    required(scope.actionDigest, 'digest'),
  ] as const;
}

export function createInternalBrowserLedger(db: TrustedBrowserDatabase) {
  return {
    async reserve(scope: BrowserScope): Promise<string> {
      const params = scopeParams(scope);
      return db.transaction(async tx => {
        required(tx.authenticatedActorId, 'actor');
        const result = await tx.query<{ reservation_id: string }>(
          'select public.atlas_browser_reserve_777($1,$2,$3,$4,$5,$6) as reservation_id',
          params,
        );
        const id = result.rows[0]?.reservation_id;
        if (!id) throw new Error('browser_reservation_unconfirmed');
        return id;
      });
    },
    async finish(scope: BrowserScope, reservationId: string, state: 'completed' | 'indeterminate'): Promise<void> {
      const params = scopeParams(scope);
      required(reservationId, 'reservation');
      if (state !== 'completed' && state !== 'indeterminate') throw new Error('browser_invalid_terminal_state');
      await db.transaction(async tx => {
        required(tx.authenticatedActorId, 'actor');
        const result = await tx.query<{ accepted: boolean }>(
          'select public.atlas_browser_finish_777($1,$2,$3,$4,$5,$6) as accepted',
          [reservationId, params[0], params[1], params[2], params[5], state],
        );
        if (result.rows[0]?.accepted !== true) throw new Error('browser_finish_unconfirmed');
      });
    },
  };
}

/**
 * Revocation is intentionally NOT exposed here. It must run inside the same
 * transaction as the authoritative membership/permission revocation, after
 * checking the administrator's permissions. The current SQL primitive alone
 * does not authenticate the revoking actor and MUST NOT be called directly.
 */
