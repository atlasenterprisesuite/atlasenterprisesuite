import type { ExecutionModuleAdapter, AdapterExecution } from '../execution/src/adapter';
import type { ExecutionActor, ExecutionStep } from '../execution/src/types';

type Point = { x: number; y: number };
type Payload = { mode: 'simulation'; objectId: string; from: Point; to: Point; runId: string };
const completed = new Set<string>();
const halted = new Set<string>();
const finite = (p: unknown): p is Point => !!p && typeof p === 'object' && Number.isFinite((p as Point).x) && Number.isFinite((p as Point).y);
const parse = (step: ExecutionStep): Payload | null => {
  const p = step.actionPayload;
  if (p.mode !== 'simulation' || typeof p.objectId !== 'string' || !p.objectId.trim() ||
      typeof p.runId !== 'string' || !p.runId.trim() || !finite(p.from) || !finite(p.to)) return null;
  if (Object.keys(p).some(k => !['mode','objectId','runId','from','to'].includes(k))) return null;
  return p as Payload;
};
export function createRoboticsSimulationAdapter(options: {
  authorize: (actor: ExecutionActor, step: ExecutionStep) => Promise<boolean>;
  currentAuthorization: (step: ExecutionStep) => Promise<boolean>;
  organizationId: string;
  tenantId: string;
}): ExecutionModuleAdapter & { emergencyStop(runId: string): void } {
  return {
    module: 'robotics',
    canHandle: action => action === 'robotics.simulation.pick_place',
    emergencyStop: runId => { halted.add(runId); },
    async validate(step) {
      return parse(step) ? { ok: true, errors: [] } : { ok: false, errors: ['simulation_payload_invalid'] };
    },
    async authorize(actor, step) {
      if (!actor.userId || actor.scope.organizationId !== options.organizationId ||
          actor.scope.tenantId !== options.tenantId ||
          !actor.permissions.includes('execution.write')) return { ok: false, reason: 'forbidden' };
      try { return await options.authorize(actor, step) ? { ok: true, reason: null } : { ok: false, reason: 'forbidden' }; }
      catch { return { ok: false, reason: 'authorization_unavailable' }; }
    },
    async execute(step): Promise<AdapterExecution> {
      const p = parse(step);
      if (!p) return { ok: false, result: {}, errorCode: 'simulation_payload_invalid' };
      if (halted.has(p.runId)) return { ok: false, result: {}, errorCode: 'emergency_stopped' };
      if (completed.has(p.runId)) return { ok: false, result: {}, errorCode: 'duplicate_run' };
      let allowed = false;
      try { allowed = await options.currentAuthorization(step); } catch { /* fail closed */ }
      if (!allowed) return { ok: false, result: {}, errorCode: 'authorization_revoked' };
      if (halted.has(p.runId)) return { ok: false, result: {}, errorCode: 'emergency_stopped' };
      completed.add(p.runId);
      return { ok: true, result: { provenance: 'simulation', physicalOutput: false, objectId: p.objectId, from: p.from, to: p.to, runId: p.runId } };
    },
    async verify(_step, execution) {
      const ok = execution.ok && execution.result.provenance === 'simulation' && execution.result.physicalOutput === false;
      return { ok, evidence: ok ? [{ kind: 'robotics_simulation', reference: String(execution.result.runId), verified: true }] : [], reason: ok ? undefined : 'simulation_not_verified' };
    },
    async suggestNext() { return null; }
  };
}
