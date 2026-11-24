import { describe, expect, it } from 'vitest';
import { closeCycle, selectReady, type CatchUpCycle } from '../../packages/catchup/lifecycle';

const cycle = (overrides: Partial<CatchUpCycle> = {}): CatchUpCycle => ({
  id: 'cycle-1',
  tenantId: 'tenant-a',
  commitments: [{ id: 'c1', state: 'verified', evidenceSha: 'abc123' }],
  jobs: [{ id: 'job-1', dependsOn: [], state: 'pending' }],
  ...overrides,
});

describe('ATLAS CatchUp 777 lifecycle (TDD contract)', () => {
  it('refuses to close when a commitment remains unresolved', () => {
    expect(() => closeCycle(cycle({
      commitments: [{ id: 'c1', state: 'pending' }],
    }), 'tenant-a')).toThrow();
  });

  it('refuses cross-tenant closure', () => {
    expect(() => closeCycle(cycle(), 'tenant-b')).toThrow();
  });

  it('requires verifiable evidence for completed commitments', () => {
    expect(() => closeCycle(cycle({
      commitments: [{ id: 'c1', state: 'verified' }],
    }), 'tenant-a')).toThrow();
  });

  it('does not run jobs before their dependencies are verified', () => {
    const jobs = [
      { id: 'a', dependsOn: [], state: 'pending' as const },
      { id: 'b', dependsOn: ['a'], state: 'pending' as const },
    ];
    expect(selectReady(jobs).map(job => job.id)).toEqual(['a']);
  });

  it('allows a verified cycle to close without deleting its provenance', () => {
    const result = closeCycle(cycle(), 'tenant-a');
    expect(result.status).toBe('complete');
    expect(result.commitments).toHaveLength(1);
  });
});
