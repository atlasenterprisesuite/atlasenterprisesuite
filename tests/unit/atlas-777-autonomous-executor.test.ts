import { describe, expect, it, vi } from 'vitest';
import { runAutonomousCycle } from '../../scripts/atlas-777-autonomous-executor.mjs';
const task = { id: 'pr-926', organizationId: 'org-a', idempotencyKey: 'job-926', sha: 'a'.repeat(40), kind: 'verify', approved: true };
function harness() {
  const state = new Map();
  const loadState = vi.fn(async (org, key) => state.get(org + ':' + key));
  const saveState = vi.fn(async (org, key, value, condition) => {
    const id = org + ':' + key, previous = state.get(id);
    if (condition.ifAbsent && previous) return false;
    if (condition.expectedStatus && previous?.status !== condition.expectedStatus) return false;
    state.set(id, structuredClone(value));
    return true;
  });
  const execute = vi.fn(async t => ({ status: 'completed', evidence: { sha: t.sha, verified: true } }));
  return { state, loadState, saveState, execute, organizationId: 'org-a' };
}
describe('ATLAS 777 autonomous executor security', () => {
  it('executes successive steps and persists evidence', async () => {
    const h = harness();
    const result = await runAutonomousCycle({ ...h, tasks: [task, { ...task, id: 'next', idempotencyKey: 'job-next' }] });
    expect(result.status).toBe('completed');
    expect(h.execute).toHaveBeenCalledTimes(2);
    expect(h.state.get('org-a:job-926').status).toBe('completed');
  });
  it('resumes completed work without repeating execution', async () => {
    const h = harness();
    await runAutonomousCycle({ ...h, tasks: [task] });
    const result = await runAutonomousCycle({ ...h, tasks: [task] });
    expect(result.completed[0].resumed).toBe(true);
    expect(h.execute).toHaveBeenCalledTimes(1);
  });
  it('rejects non-commit SHA before state writes or execution', async () => {
    const h = harness();
    const result = await runAutonomousCycle({ ...h, tasks: [{ ...task, sha: 'abc123' }] });
    expect(result.reason).toBe('TENANT_OR_TASK_INVALID');
    expect(h.saveState).not.toHaveBeenCalled();
    expect(h.execute).not.toHaveBeenCalled();
  });
  it('blocks cross-tenant input before execution', async () => {
    const h = harness();
    const result = await runAutonomousCycle({ ...h, tasks: [{ ...task, organizationId: 'org-b' }] });
    expect(result.reason).toBe('TENANT_OR_TASK_INVALID');
    expect(h.execute).not.toHaveBeenCalled();
  });
  it('stops before deploy and unapproved tasks', async () => {
    const h = harness();
    expect((await runAutonomousCycle({ ...h, tasks: [{ ...task, kind: 'deploy' }] })).status).toBe('authorization_required');
    expect((await runAutonomousCycle({ ...h, tasks: [{ ...task, approved: false }] })).status).toBe('authorization_required');
    expect(h.execute).not.toHaveBeenCalled();
  });
  it('rejects evidence SHA mismatch', async () => {
    const h = harness();
    h.execute.mockResolvedValue({ status: 'completed', evidence: { sha: 'wrong', verified: true } });
    expect((await runAutonomousCycle({ ...h, tasks: [task] })).reason).toBe('EVIDENCE_MISMATCH');
  });
  it('blocks duplicate idempotency keys', async () => {
    const h = harness();
    expect((await runAutonomousCycle({ ...h, tasks: [task, { ...task, id: 'other' }] })).reason).toBe('DUPLICATE_KEY');
  });
  it('blocks concurrent claims', async () => {
    const h = harness();
    h.saveState.mockResolvedValue(false);
    expect((await runAutonomousCycle({ ...h, tasks: [task] })).reason).toBe('CONCURRENT_CLAIM');
    expect(h.execute).not.toHaveBeenCalled();
  });
  it('fails closed on incomplete state', async () => {
    const h = harness();
    h.state.set('org-a:job-926', { organizationId: 'org-a', taskId: 'pr-926', sha: 'a'.repeat(40), status: 'pending' });
    expect((await runAutonomousCycle({ ...h, tasks: [task] })).reason).toBe('INCOMPLETE_STATE_REQUIRES_RECONCILIATION');
  });
  it('rejects duplicate task ids even with different idempotency keys', async () => {
    const h = harness();
    const result = await runAutonomousCycle({ ...h, tasks: [task, { ...task, idempotencyKey: 'job-other' }] });
    expect(result.reason).toBe('DUPLICATE_TASK_ID');
    expect(h.execute).not.toHaveBeenCalled();
    expect(h.saveState).not.toHaveBeenCalled();
  });
  it('never forwards arbitrary untrusted fields to the executor callback', async () => {
    const h = harness();
    const result = await runAutonomousCycle({ ...h, tasks: [{ ...task, operation: 'withdraw', credentials: 'untrusted' }] });
    expect(result.status).toBe('completed');
    expect(h.execute).toHaveBeenCalledTimes(1);
    const forwarded = h.execute.mock.calls[0][0];
    expect(forwarded).not.toHaveProperty('operation');
    expect(forwarded).not.toHaveProperty('credentials');
    expect(Object.isFrozen(forwarded)).toBe(true);
  });
  it('bounds execution and preserves unfinished work', async () => {
    const h = harness();
    const result = await runAutonomousCycle({ ...h, tasks: [task, { ...task, id: 'next', idempotencyKey: 'job-next' }], maxSteps: 1 });
    expect(result.status).toBe('paused');
    expect(h.execute).toHaveBeenCalledTimes(1);
  });
});
