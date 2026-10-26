import { describe, expect, it, vi } from 'vitest';
import { runAutonomousCycle } from '../../scripts/atlas-777-autonomous-executor.mjs';
const task = { id: 'pr-926', sha: 'abc123', kind: 'verify', approved: true };
describe('ATLAS autonomous executor safety contract', () => {
  it('processes successive verified steps', async () => {
    const execute = vi.fn(async () => ({ status: 'completed', evidence: { sha: 'abc123', verified: true } }));
    expect((await runAutonomousCycle({ tasks: [task, { ...task, id: 'next' }], execute })).status).toBe('completed');
    expect(execute).toHaveBeenCalledTimes(2);
  });
  it('stops before human-gated actions', async () => {
    const execute = vi.fn();
    expect((await runAutonomousCycle({ tasks: [{ ...task, kind: 'deploy' }], execute })).status).toBe('authorization_required');
    expect(execute).not.toHaveBeenCalled();
  });
  it('rejects incorrect SHA evidence', async () => {
    const execute = vi.fn(async () => ({ status: 'completed', evidence: { sha: 'wrong', verified: true } }));
    expect((await runAutonomousCycle({ tasks: [task], execute })).status).toBe('blocked');
  });
  it('rejects unapproved tasks', async () => {
    const execute = vi.fn();
    expect((await runAutonomousCycle({ tasks: [{ ...task, approved: false }], execute })).status).toBe('authorization_required');
    expect(execute).not.toHaveBeenCalled();
  });
  it('bounds execution without claiming completion', async () => {
    const execute = vi.fn(async () => ({ status: 'completed', evidence: { sha: 'abc123', verified: true } }));
    expect((await runAutonomousCycle({ tasks: [task, { ...task, id: 'next' }], execute, maxSteps: 1 })).status).toBe('paused');
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
