export type Commitment = { id: string; state: 'pending' | 'verified' | 'transferred'; evidenceSha?: string; transferredTo?: string };
export type CatchUpJob = { id: string; dependsOn: string[]; state: 'pending' | 'running' | 'verified' | 'failed' };
export type CatchUpCycle = {
  id: string;
  tenantId: string;
  status?: 'open' | 'complete';
  commitments: Commitment[];
  jobs: CatchUpJob[];
};

export function selectReady(jobs: readonly CatchUpJob[]): CatchUpJob[] {
  const ids = new Set(jobs.map(job => job.id));
  if (ids.size !== jobs.length) throw new Error('Duplicate job identifiers');
  const byId = new Map(jobs.map(job => [job.id, job]));
  return jobs.filter(job => job.state === 'pending' && job.dependsOn.every(dep => {
    const dependency = byId.get(dep);
    if (!dependency) throw new Error('Unknown dependency');
    return dependency.state === 'verified';
  }));
}

export function closeCycle(cycle: CatchUpCycle, tenantId: string): CatchUpCycle & { status: 'complete' } {
  if (!tenantId || cycle.tenantId !== tenantId) throw new Error('Tenant access denied');
  if (!cycle.id || cycle.commitments.length === 0) throw new Error('Empty cycle cannot close');
  const commitmentIds = new Set(cycle.commitments.map(item => item.id));
  if (commitmentIds.size !== cycle.commitments.length) throw new Error('Duplicate commitments');
  for (const item of cycle.commitments) {
    if (!item.id || (item.state === 'verified' && !item.evidenceSha?.trim()) ||
        (item.state === 'transferred' && !item.transferredTo?.trim()) ||
        item.state === 'pending') throw new Error('Unresolved commitment');
  }
  return { ...cycle, status: 'complete', commitments: cycle.commitments.map(item => ({ ...item })) };
}
