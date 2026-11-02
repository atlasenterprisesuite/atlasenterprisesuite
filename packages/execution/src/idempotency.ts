/** Durable stores MUST enforce a unique (tenant, organization, key) constraint in one transaction. */
export interface ExecutionScope { tenantId: string; organizationId: string; key: string }
export interface ExecutionLeaseStore {
  claim(scope: ExecutionScope): Promise<'claimed' | 'duplicate'>;
  complete(scope: ExecutionScope, result: unknown): Promise<void>;
  /** Terminal indeterminate state: MUST NOT make the same key claimable again. */
  fail(scope: ExecutionScope): Promise<void>;
}
export async function executeOnce<T>(store: ExecutionLeaseStore, scope: ExecutionScope, run: () => Promise<T>): Promise<T> {
  if (!scope.tenantId || !scope.organizationId || !scope.key) throw new Error('invalid_idempotency_scope');
  if (await store.claim(scope) !== 'claimed') throw new Error('duplicate_execution');
  let result: T;
  try {
    result = await run();
  } catch (error) {
    // A remote side effect may already have occurred. Never release the key for replay.
    try { await store.fail(scope); } catch { throw new Error('idempotency_state_indeterminate'); }
    throw error;
  }
  // A failed commit is indeterminate, NOT permission to rerun the side effect.
  try { await store.complete(scope, result); }
  catch { throw new Error('idempotency_commit_indeterminate'); }
  return result;
}
