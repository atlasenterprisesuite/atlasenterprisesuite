import { describe, expect, it } from 'vitest';
import { ManusDisabledAdapter } from '../../apps/atlas-orchestrator/src/runtime/manusDisabledAdapter';
describe('Manus provider fail-closed', () => {
  it('never fabricates a provider receipt, output or execution', async () => {
    const adapter = new ManusDisabledAdapter();
    await expect(adapter.invoke({ taskId: 'task-1', agentId: 'manus', prompt: 'test', allowedTools: [], correlationId: 'corr-1' })).rejects.toThrow('ATLAS_MANUS_NOT_CONNECTED');
  });

  it('ATLAS-VALIDATE-001 blocks a read-only Manus pilot without real credentials', async () => {
    const adapter = new ManusDisabledAdapter();
    await expect(adapter.invoke({
      taskId: 'ATLAS-VALIDATE-001',
      agentId: 'manus',
      prompt: 'Read-only inspection of ATLAS GitHub issue #1006; no edits or external side effects',
      allowedTools: ['atlas.task.read', 'atlas.repo.inspect', 'atlas.audit.read'],
      correlationId: 'ATLAS-VALIDATE-001'
    })).rejects.toThrow('ATLAS_MANUS_NOT_CONNECTED');
  });
});
