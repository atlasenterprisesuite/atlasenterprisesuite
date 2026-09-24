import type { WorkRuntimePreference } from './work-types';

export type WorkRuntimeKind = Exclude<WorkRuntimePreference, 'auto'>;
export type WorkRuntimeStatus = 'online' | 'offline' | 'degraded' | 'revoked';

export type WorkRuntime = {
  id: string;
  kind: WorkRuntimeKind;
  status: WorkRuntimeStatus;
  capabilities: string[];
  lastSeenAt: string | null;
};

export type RuntimeSelectionRequest = {
  preference: WorkRuntimePreference;
  requiredCapabilities: string[];
  runtimes: WorkRuntime[];
};

export type RuntimeSelectionDecision = {
  state: 'ready' | 'blocked';
  runtimeId: string | null;
  runtimeKind: WorkRuntimeKind | null;
  reason: string;
};

const AUTO_PRIORITY: WorkRuntimeKind[] = ['local', 'self_hosted', 'cloud_ephemeral'];
const STALE_AFTER_MS = 120_000;

export function runtimeIsHealthy(runtime: WorkRuntime, now: string | Date = new Date()) {
  if (runtime.status !== 'online' || !runtime.lastSeenAt) return false;
  const nowMs = new Date(now).getTime();
  const seenMs = new Date(runtime.lastSeenAt).getTime();
  if (!Number.isFinite(nowMs) || !Number.isFinite(seenMs)) return false;
  return nowMs >= seenMs && nowMs - seenMs <= STALE_AFTER_MS;
}

function hasCapabilities(runtime: WorkRuntime, required: string[]) {
  return required.every((capability) => runtime.capabilities.includes(capability));
}

export function selectWorkRuntime(request: RuntimeSelectionRequest, now: string | Date = new Date()): RuntimeSelectionDecision {
  const eligible = request.runtimes.filter((runtime) => runtimeIsHealthy(runtime, now) && hasCapabilities(runtime, request.requiredCapabilities));
  const order = request.preference === 'auto' ? AUTO_PRIORITY : [request.preference];

  for (const kind of order) {
    const match = eligible.find((runtime) => runtime.kind === kind);
    if (match) return { state: 'ready', runtimeId: match.id, runtimeKind: match.kind, reason: 'healthy_runtime_available' };
  }

  return {
    state: 'blocked',
    runtimeId: null,
    runtimeKind: request.preference === 'auto' ? null : request.preference,
    reason: request.preference === 'auto' ? 'no_eligible_runtime' : 'requested_runtime_unavailable'
  };
}
