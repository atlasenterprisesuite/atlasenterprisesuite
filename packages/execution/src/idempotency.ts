/** Durable implementations must enforce a unique (tenant, organization, key) constraint transactionally. */
export interface ExecutionLeaseStore {
  claim(scope: {tenantId: string; organizationId: string; key: string}): Promise<'claimed' | 'duplicate'>;
  complete(scope: {tenantId: string; organizationId: string; key: string}, result: unknown): Promise<void>;
  fail(scope: {tenantId: string; organizationId: string; key: string}): Promise<void>;
}
export async function executeOnce<T>(store: ExecutionLeaseStore, scope: {tenantId: string; organizationId: string; key: string}, run: () => Promise<T>): Promise<T> {
  if (!scope.tenantId || !scope.organizationId || !scope.key) throw new Error('invalid_idempotency_scope');
  if (await store.claim(scope) !== 'claimed') throw new Error('duplicate_execution');
  try { const result = await run(); await store.complete(scope, result); return result; }
  catch (error) { await store.fail(scope); throw error; }
}
