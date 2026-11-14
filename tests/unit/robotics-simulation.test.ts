import { describe, expect, it } from 'vitest';
import { createRoboticsSimulationAdapter, createInMemoryRoboticsRunStore } from '../../packages/robotics/simulation-adapter';
import type { ExecutionActor, ExecutionStep } from '../../packages/execution/src/types';
const actor = { userId: 'u1', scope: { tenantId: 't1', organizationId: 'o1' }, permissions: ['execution.write'] } as ExecutionActor;
let serial = 0;
const step = (overrides: Record<string, unknown> = {}) => ({
  id: 's', taskId: 't', sequence: 1, module: 'robotics', actionType: 'robotics.simulation.pick_place',
  actionPayload: { mode: 'simulation', objectId: 'cube', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, runId: 'run-' + ++serial, ...overrides },
  status: 'ready', completionCriteria: [], permissionsRequired: [], dependencyIds: [], evidenceRequirement: [], startedAt: null, completedAt: null
}) as ExecutionStep;
const adapter = (auth = true, current = true) => createRoboticsSimulationAdapter({
  organizationId: 'o1', tenantId: 't1', store: createInMemoryRoboticsRunStore(), authorize: async () => auth, currentAuthorization: async () => current
});
describe('Robotics simulation security contract', () => {
  it('ROB-001 executes a deterministic simulation only', async () => { const a=adapter(), s=step(); expect((await a.execute(s)).result).toMatchObject({provenance:'simulation',physicalOutput:false,to:{x:1,y:1}}); });
  it('ROB-002 denies actor without write permission', async () => { expect((await adapter().authorize({...actor,permissions:[]},step())).ok).toBe(false); });
  it('ROB-003 denies cross-organization actor', async () => { expect((await adapter().authorize({...actor,scope:{tenantId:'t1',organizationId:'o2'}},step())).ok).toBe(false); });
  it('ROB-004 denies revoked authorization at execution', async () => { expect((await adapter(true,false).execute(step())).errorCode).toBe('authorization_revoked'); });
  it('ROB-005 rejects unverified device fields', async () => { expect((await adapter().validate(step({deviceId:'unverified'}))).ok).toBe(false); });
  it('ROB-006 rejects physical mode', async () => { expect((await adapter().execute(step({mode:'physical'}))).ok).toBe(false); });
  it('ROB-007 rejects repeated run ID', async () => { const a=adapter(), s=step(); expect((await a.execute(s)).ok).toBe(true); expect((await a.execute(s)).errorCode).toBe('duplicate_run'); });
  it('ROB-008 fails closed on simulator authorization error', async () => { const a=createRoboticsSimulationAdapter({organizationId:'o1',tenantId:'t1',store:createInMemoryRoboticsRunStore(),authorize:async()=>true,currentAuthorization:async()=>{throw Error('offline')}}); expect((await a.execute(step())).ok).toBe(false); });
  it('ROB-009 emergency stop prevents execution', async () => { const a=adapter(),s=step(); await a.emergencyStop(String(s.actionPayload.runId)); expect((await a.execute(s)).errorCode).toBe('emergency_stopped'); });
  it('ROB-010 rejects evidence injection in payload', async () => { expect((await adapter().validate(step({evidence:{verified:true}}))).ok).toBe(false); });
  it('ROB-011 concurrent duplicate requests yield exactly one success', async () => {
    const a=adapter(), s=step();
    const results=await Promise.all([a.execute(s),a.execute(s)]);
    expect(results.filter(r=>r.ok)).toHaveLength(1);
  });
  it('ROB-012 identical run IDs are isolated between tenant scopes', async () => {
    const store=createInMemoryRoboticsRunStore(),s=step();
    const make=(tenantId:string)=>createRoboticsSimulationAdapter({organizationId:'o1',tenantId,store,authorize:async()=>true,currentAuthorization:async()=>true});
    expect((await make('t1').execute(s)).ok).toBe(true);
    expect((await make('t2').execute(s)).ok).toBe(true);
  });
  it('ROB-013 invalid coordinates fail closed', async () => {
    expect((await adapter().validate(step({to:{x:Infinity,y:0}}))).ok).toBe(false);
    expect((await adapter().validate(step({from:{x:101,y:0}}))).ok).toBe(false);
  });
  it('ROB-014 emergency stop persists across adapters sharing a store', async () => {
    const store=createInMemoryRoboticsRunStore(),s=step();
    const make=()=>createRoboticsSimulationAdapter({organizationId:'o1',tenantId:'t1',store,authorize:async()=>true,currentAuthorization:async()=>true});
    await make().emergencyStop(String(s.actionPayload.runId));
    expect((await make().execute(s)).errorCode).toBe('emergency_stopped');
  });
});
