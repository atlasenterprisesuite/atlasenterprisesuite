import { describe, expect, it } from 'vitest';
import { evaluateAgentDispatch, rejectDuplicateTask, verifyAgentCompletion, type AtlasAgentTask } from '../../apps/atlas-orchestrator/src/runtime/multiAgentContract';
const task: AtlasAgentTask = { taskId: 'atlas-001', tenantId: 'tenant-a', organizationId: 'org-a', agent: 'manus', goal: 'Research', idempotencyKey: 'once-001', requiresApproval: false };
const context = { tenantId: 'tenant-a', organizationId: 'org-a', authorized: true, approved: false, providerEnabled: false };
describe('ATLAS multi-agent fail-closed contract', () => {
  it('blocks Manus when no real provider connection is enabled', () => {
    expect(evaluateAgentDispatch(task, context)).toMatchObject({ status: 'blocked', reason: 'provider_not_connected' });
  });
  it('rejects cross-tenant and cross-organization dispatch', () => {
    expect(evaluateAgentDispatch(task, { ...context, tenantId: 'tenant-b', providerEnabled: true }).status).toBe('blocked');
    expect(evaluateAgentDispatch(task, { ...context, organizationId: 'org-b', providerEnabled: true }).status).toBe('blocked');
  });
  it('requires authorization and approval before queueing', () => {
    expect(evaluateAgentDispatch(task, { ...context, authorized: false, providerEnabled: true }).status).toBe('blocked');
    expect(evaluateAgentDispatch({ ...task, requiresApproval: true }, { ...context, providerEnabled: true }).status).toBe('waiting_approval');
    expect(evaluateAgentDispatch({ ...task, requiresApproval: true }, { ...context, providerEnabled: true, approved: true }).status).toBe('queued');
  });
  it('does not confuse queued or fictitious output with completed execution', () => {
    const receipt = evaluateAgentDispatch(task, { ...context, providerEnabled: true });
    expect(verifyAgentCompletion(receipt)).toBe(false);
    expect(verifyAgentCompletion({ ...receipt, status: 'completed', evidenceRefs: ['fake'] })).toBe(false);
    expect(verifyAgentCompletion({ ...receipt, status: 'completed', providerExecutionId: 'provider-123', evidenceRefs: ['evidence-123'] })).toBe(true);
  });
  it('rejects duplicate idempotency keys within scope', () => {
    expect(() => rejectDuplicateTask(task, { ...task, taskId: 'atlas-002' })).toThrow('duplicate_idempotency_key');
    expect(() => rejectDuplicateTask(task, { ...task, tenantId: 'tenant-b' })).not.toThrow();
  });
});
