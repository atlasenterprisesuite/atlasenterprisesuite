import { claim, finish, type Job, type Transition } from './atlas777Executor';

/**
 * Storage contract for a durable ATLAS 777 worker.
 * Implementations MUST use an atomic compare-and-swap on version, never read-then-write.
 * The adapter is deliberately not wired to production until persistence, auth and RLS
 * are independently verified. No database credentials belong in this module.
 */
export type VersionedJob = Readonly<{ job: Job; version: number }>;
export interface AtomicJobStore {
  get(jobId: string): Promise<VersionedJob | null>;
  /** Return false on version conflict; MUST persist atomically. */
  compareAndSwap(jobId: string, expectedVersion: number, next: Job): Promise<boolean>;
}
export type WorkerResult = Transition & { persisted: boolean };
const denied = (job: Job, reason: string): WorkerResult => ({ job, accepted: false, reason, persisted: false });

export async function claimPersisted(
  store: AtomicJobStore, jobId: string, owner: string, nowMs: number, leaseMs: number
): Promise<WorkerResult | null> {
  const snapshot = await store.get(jobId);
  if (!snapshot) return null;
  const transition = claim(snapshot.job, owner, nowMs, leaseMs);
  if (!transition.accepted) return { ...transition, persisted: false };
  const saved = await store.compareAndSwap(jobId, snapshot.version, transition.job);
  return saved ? { ...transition, persisted: true } : denied(snapshot.job, 'version_conflict');
}
export async function finishPersisted(
  store: AtomicJobStore, jobId: string, owner: string, nowMs: number,
  outcome: 'completed' | 'blocked' | 'retry'
): Promise<WorkerResult | null> {
  const snapshot = await store.get(jobId);
  if (!snapshot) return null;
  const transition = finish(snapshot.job, owner, nowMs, outcome);
  if (!transition.accepted) return { ...transition, persisted: false };
  const saved = await store.compareAndSwap(jobId, snapshot.version, transition.job);
  return saved ? { ...transition, persisted: true } : denied(snapshot.job, 'version_conflict');
}
