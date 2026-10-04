import { describe, expect, it, vi } from 'vitest';
import { createWorkflowRuntime } from '../../supabase/functions/atlas-copilot/workflow-runtime.mjs';

const context = { organization_id: 'org-1', user_id: 'user-1', permissions: ['intelligence.use'] };

function memoryStore() {
  const rows = new Map<string, any>();
  return {
    createWorkflowRun: vi.fn(async ({ run }: any) => { rows.set(run.id, structuredClone(run)); return structuredClone(run); }),
    getWorkflowRun: vi.fn(async ({ run_id }: any) => structuredClone(rows.get(run_id) || null)),
    saveWorkflowRun: vi.fn(async ({ run }: any) => { rows.set(run.id, structuredClone(run)); return structuredClone(run); }),
  };
}

describe('ATLAS deterministic workflow runtime', () => {
  it('executes sequential task and verify steps and persists every state transition', async () => {
    const store = memoryStore();
    const runtime = createWorkflowRuntime({
      store,
      workflows: [{ id: 'wf-seq', version: 1, steps: [
        { id: 'inspect', type: 'task', executor: 'inspect' },
        { id: 'verify', type: 'verify', executor: 'verify' },
      ] }],
      executors: {
        inspect: async ({ input }: any) => ({ files: input.files }),
        verify: async ({ outputs }: any) => ({ ok: outputs.inspect.files.length === 1 }),
      },
      idFactory: () => 'run-1',
      clock: () => 1000,
    });

    const result = await runtime.execute({ context, workflow_id: 'wf-seq', input: { files: ['a.ts'] } });

    expect(result.status).toBe('completed');
    expect(result.outputs).toEqual({ inspect: { files: ['a.ts'] }, verify: { ok: true } });
    expect(store.createWorkflowRun).toHaveBeenCalledTimes(1);
    expect(store.saveWorkflowRun.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('runs independent parallel branches and preserves deterministic keyed outputs', async () => {
    const store = memoryStore();
    const runtime = createWorkflowRuntime({
      store,
      workflows: [{ id: 'wf-parallel', version: 1, steps: [
        { id: 'reviews', type: 'parallel', branches: [
          { id: 'security', executor: 'security' },
          { id: 'quality', executor: 'quality' },
        ] },
      ] }],
      executors: {
        security: async () => ({ findings: ['sec'] }),
        quality: async () => ({ findings: ['quality'] }),
      },
      idFactory: () => 'run-2',
      clock: () => 2000,
    });

    const result = await runtime.execute({ context, workflow_id: 'wf-parallel', input: {} });

    expect(result.status).toBe('completed');
    expect(result.outputs.reviews).toEqual({ security: { findings: ['sec'] }, quality: { findings: ['quality'] } });
  });

  it('pauses at checkpoints and resumes only after an explicit approval decision', async () => {
    const store = memoryStore();
    const after = vi.fn(async () => ({ released: true }));
    const runtime = createWorkflowRuntime({
      store,
      workflows: [{ id: 'wf-checkpoint', version: 1, steps: [
        { id: 'prepare', type: 'task', executor: 'prepare' },
        { id: 'release-gate', type: 'checkpoint' },
        { id: 'after', type: 'task', executor: 'after' },
      ] }],
      executors: { prepare: async () => ({ ready: true }), after },
      idFactory: () => 'run-3',
      clock: () => 3000,
    });

    const paused = await runtime.execute({ context, workflow_id: 'wf-checkpoint', input: {} });
    expect(paused.status).toBe('awaiting_checkpoint');
    expect(paused.checkpoint).toMatchObject({ step_id: 'release-gate' });
    expect(after).not.toHaveBeenCalled();

    const resumed = await runtime.resume({ context, run_id: 'run-3', approval: { approved: true, actor_id: 'user-1' } });
    expect(resumed.status).toBe('completed');
    expect(resumed.outputs.after).toEqual({ released: true });
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('fails closed on a parallel branch failure while preserving successful branch evidence', async () => {
    const store = memoryStore();
    const runtime = createWorkflowRuntime({
      store,
      workflows: [{ id: 'wf-fail', version: 1, steps: [
        { id: 'reviews', type: 'parallel', branches: [
          { id: 'security', executor: 'security' },
          { id: 'quality', executor: 'quality' },
        ] },
      ] }],
      executors: {
        security: async () => ({ findings: ['sec'] }),
        quality: async () => { throw Object.assign(new Error('provider unavailable'), { code: 'provider_unavailable' }); },
      },
      idFactory: () => 'run-4',
      clock: () => 4000,
    });

    const result = await runtime.execute({ context, workflow_id: 'wf-fail', input: {} });
    expect(result.status).toBe('failed');
    expect(result.outputs.reviews.security).toEqual({ findings: ['sec'] });
    expect(result.errors).toEqual([expect.objectContaining({ step_id: 'reviews', branch_id: 'quality', code: 'provider_unavailable' })]);
  });

  it('requires intelligence.use and a durable store contract before executing anything', async () => {
    expect(() => createWorkflowRuntime({ store: {}, workflows: [], executors: {} })).toThrow('workflow_store_required');

    const store = memoryStore();
    const runtime = createWorkflowRuntime({ store, workflows: [{ id: 'wf', version: 1, steps: [] }], executors: {}, idFactory: () => 'run-5' });
    await expect(runtime.execute({ context: { ...context, permissions: [] }, workflow_id: 'wf', input: {} }))
      .rejects.toMatchObject({ code: 'permission_denied', status: 403 });
  });
});
