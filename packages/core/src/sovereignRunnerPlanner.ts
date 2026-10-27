import { authorizeRunnerJob, type RunnerGrant, type RunnerJob } from './sovereignRunnerContract';

/** Static execution plan only. Never invokes child processes or trusts a caller-supplied command. */
export type RunnerExecutionPolicy = {
  maxDurationMs: number;
  maxMemoryMb: number;
  maxOutputBytes: number;
  maxParallel: number;
  allowNetwork: false;
  isolationAttested: boolean;
  dependenciesAttested: boolean;
  secretsAbsentAttested: boolean;
};
export type RunnerStep = 'gps5d-unit' | 'gps5d-typecheck' | 'gps5d-postgres';
export type RunnerPlan = { allowed: boolean; reasons: string[]; steps: readonly RunnerStep[]; cancellationToken: string | null };
const STEPS: readonly RunnerStep[] = ['gps5d-unit', 'gps5d-typecheck', 'gps5d-postgres'];
const MAX = { duration: 1200000, memory: 4096, output: 10485760, parallel: 2 };

export function planSovereignRunner(job: unknown, grant: unknown, policy: unknown): RunnerPlan {
  const reasons = authorizeRunnerJob(job, grant).reasons;
  const p = policy && typeof policy === 'object' && !Array.isArray(policy) ? policy as Partial<RunnerExecutionPolicy> : {};
  const bounded = (v: unknown, max: number) => Number.isSafeInteger(v) && typeof v === 'number' && v > 0 && v <= max;
  if (!bounded(p.maxDurationMs, MAX.duration)) reasons.push('invalid-duration');
  if (!bounded(p.maxMemoryMb, MAX.memory)) reasons.push('invalid-memory');
  if (!bounded(p.maxOutputBytes, MAX.output)) reasons.push('invalid-output-limit');
  if (!bounded(p.maxParallel, MAX.parallel)) reasons.push('invalid-parallelism');
  if (p.allowNetwork !== false) reasons.push('network-not-denied');
  if (p.isolationAttested !== true) reasons.push('isolation-unverified');
  if (p.dependenciesAttested !== true) reasons.push('dependencies-unverified');
  if (p.secretsAbsentAttested !== true) reasons.push('secrets-unverified');
  if (reasons.length) return { allowed: false, reasons, steps: [], cancellationToken: null };
  const j = job as RunnerJob;
  return { allowed: true, reasons: [], steps: STEPS, cancellationToken: j.jobId + ':' + j.leaseId + ':' + j.attempt };
}

/** Planning a job does not certify isolation or authorize execution on a host. */
export function canCancelPlannedJob(job: RunnerJob, grant: RunnerGrant, token: string): boolean {
  const decision = authorizeRunnerJob(job, grant);
  return decision.allowed && token === job.jobId + ':' + job.leaseId + ':' + job.attempt;
}
