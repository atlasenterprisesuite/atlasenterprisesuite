import type { ExecutionModuleAdapter, AdapterExecution } from '../execution/src/adapter';
import type { ExecutionActor, ExecutionStep } from '../execution/src/types';

type Point = { x: number; y: number };
type Payload = { mode: 'simulation'; objectId: string; from: Point; to: Point; runId: string };
type Scope = { tenantId: string; organizationId: string };
type Reservation = { status: 'reserved' | 'completed' | 'halted' };
export interface RoboticsRunStore {
  reserve(scope: Scope, runId: string): Promise<boolean>;
  complete(scope: Scope, runId: string): Promise<void>;
  halt(scope: Scope, runId: string): Promise<void>;
  isHalted(scope: Scope, runId: string): Promise<boolean>;
}
const key = (scope: Scope, id: string) => JSON.stringify([scope.tenantId, scope.organizationId, id]);
/** Test-only store. Distributed deployments MUST supply transactional durable storage. */
export function createInMemoryRoboticsRunStore(): RoboticsRunStore {
  const entries = new Map<string, Reservation>();
  return {
    async reserve(scope, id) {
      const k = key(scope, id);
      if (entries.has(k)) return false;
      entries.set(k, { status: 'reserved' });
      return true;
    },
    async complete(scope, id) {
      const k = key(scope, id);
      if (entries.get(k)?.status !== 'reserved') throw Error('run_not_reserved');
      entries.set(k, { status: 'completed' });
    },
    async halt(scope, id) { entries.set(key(scope, id), { status: 'halted' }); },
    async isHalted(scope, id) { return entries.get(key(scope, id))?.status === 'halted'; }
  };
}
const point = (value: unknown): value is Point => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 2 && Object.keys(v).every(k => k === 'x' || k === 'y') &&
    typeof v.x === 'number' && Number.isFinite(v.x) && Math.abs(v.x) <= 100 &&
    typeof v.y === 'number' && Number.isFinite(v.y) && Math.abs(v.y) <= 100;
};
const parse = (step: ExecutionStep): Payload | null => {
  if (step.module !== 'robotics' || step.actionType !== 'robotics.simulation.pick_place') return null;
  const p = step.actionPayload;
  if (!p || Object.keys(p).length !== 5 || Object.keys(p).some(k => !['mode','objectId','from','to','runId'].includes(k))) return null;
  if (p.mode !== 'simulation' || typeof p.objectId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(p.objectId) ||
      typeof p.runId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(p.runId) || !point(p.from) || !point(p.to)) return null;
  return p as Payload;
};
export function createRoboticsSimulationAdapter(options: {
  authorize: (actor: ExecutionActor, step: ExecutionStep) => Promise<boolean>;
  currentAuthorization: (step: ExecutionStep) => Promise<boolean>;
  organizationId: string;
  tenantId: string;
  store: RoboticsRunStore;
}): ExecutionModuleAdapter & { emergencyStop(runId: string): Promise<void> } {
  const scope = { tenantId: options.tenantId, organizationId: options.organizationId };
  return {
    module: 'robotics',
    canHandle: action => action === 'robotics.simulation.pick_place',
    emergencyStop: runId => options.store.halt(scope, runId),
    async validate(step) { return parse(step) ? { ok: true, errors: [] } : { ok: false, errors: ['simulation_payload_invalid'] }; },
    async authorize(actor, step) {
      if (!parse(step) || !actor.userId || actor.scope.organizationId !== scope.organizationId ||
          actor.scope.tenantId !== scope.tenantId || !actor.permissions.includes('execution.write'))
        return { ok: false, reason: 'forbidden' };
      try { return await options.authorize(actor, step) ? { ok: true, reason: null } : { ok: false, reason: 'forbidden' }; }
      catch { return { ok: false, reason: 'authorization_unavailable' }; }
    },
    async execute(step): Promise<AdapterExecution> {
      const p = parse(step);
      if (!p) return { ok: false, result: {}, errorCode: 'simulation_payload_invalid' };
      try {
        if (await options.store.isHalted(scope, p.runId)) return { ok: false, result: {}, errorCode: 'emergency_stopped' };
        if (!await options.store.reserve(scope, p.runId)) return { ok: false, result: {}, errorCode: 'duplicate_run' };
        if (!await options.currentAuthorization(step)) return { ok: false, result: {}, errorCode: 'authorization_revoked' };
        if (await options.store.isHalted(scope, p.runId)) return { ok: false, result: {}, errorCode: 'emergency_stopped' };
        await options.store.complete(scope, p.runId);
        return { ok: true, result: { provenance: 'simulation', physicalOutput: false, objectId: p.objectId, from: p.from, to: p.to, runId: p.runId } };
      } catch { return { ok: false, result: {}, errorCode: 'simulation_fail_closed' }; }
    },
    async verify(_step, execution) {
      const ok = execution.ok && execution.result.provenance === 'simulation' &&
        execution.result.physicalOutput === false && typeof execution.result.runId === 'string';
      return { ok, evidence: ok ? [{ kind: 'robotics_simulation', reference: String(execution.result.runId), verified: true }] : [], reason: ok ? undefined : 'simulation_not_verified' };
    },
    async suggestNext() { return null; }
  };
}
