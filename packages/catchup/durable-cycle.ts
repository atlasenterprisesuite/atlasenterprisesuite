import type { CatchUpCycle } from './lifecycle';

/** Durable boundary: implementations must enforce tenant RLS/RBAC and atomic version checks in storage.
 * This contract alone is NOT a database adapter or production persistence.
 */
export type VersionedCycle = Readonly<{ cycle: CatchUpCycle; version: number }>;
export interface DurableCycleStore {
  read(tenantId: string, cycleId: string): Promise<VersionedCycle | null>;
  /** Compare and swap must be a single database transaction scoped to tenantId. */
  compareAndSwap(tenantId: string, cycleId: string, version: number, next: CatchUpCycle): Promise<boolean>;
}

export type CycleUpdate = Readonly<{ accepted: boolean; reason: string; version?: number }>;
export async function transitionCycle(
  store: DurableCycleStore,
  tenantId: string,
  cycleId: string,
  update: (cycle: CatchUpCycle) => CatchUpCycle
): Promise<CycleUpdate> {
  if (!tenantId?.trim() || !cycleId?.trim()) return { accepted: false, reason: 'invalid_scope' };
  const snapshot = await store.read(tenantId, cycleId);
  if (!snapshot || snapshot.cycle.tenantId !== tenantId || snapshot.cycle.id !== cycleId ||
      !Number.isSafeInteger(snapshot.version) || snapshot.version < 0)
    return { accepted: false, reason: 'not_found_or_unauthorized' };
  const next = update(structuredClone(snapshot.cycle));
  if (next.tenantId !== tenantId || next.id !== cycleId)
    return { accepted: false, reason: 'scope_change_denied' };
  const saved = await store.compareAndSwap(tenantId, cycleId, snapshot.version, next);
  return saved
    ? { accepted: true, reason: 'persisted', version: snapshot.version + 1 }
    : { accepted: false, reason: 'version_conflict' };
}
