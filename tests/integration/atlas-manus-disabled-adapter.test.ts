import { describe, expect, it } from 'vitest';
import { ManusDisabledAdapter } from '../../apps/atlas-orchestrator/src/runtime/manusDisabledAdapter';
describe('Manus provider fail-closed', () => {
  it('never fabricates a provider receipt, output or execution', async () => {
    const adapter = new ManusDisabledAdapter();
    await expect(adapter.invoke({ taskId: 'task-1', agentId: 'manus', prompt: 'test', allowedTools: [], correlationId: 'corr-1' })).rejects.toThrow('ATLAS_MANUS_NOT_CONNECTED');
  });
});
