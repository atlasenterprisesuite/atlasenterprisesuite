import { describe, expect, it } from 'vitest';
import { planSovereignRunner, canCancelPlannedJob } from '../../packages/core/src/sovereignRunnerPlanner';

const job = { jobId:'job-1',tenantId:'tenant-a',requestedBy:'alice',repository:'atlasenterprisesuite/atlasenterprisesuite',commitSha:'a'.repeat(40),kind:'gps5d-synthetic-tdd' as const,leaseId:'lease-1',attempt:1,isolationEvidenceId:'iso-1',dependencyEvidenceId:'deps-1' };
const grant = { tenantId:'tenant-a',principalId:'alice',activeMember:true,canExecuteTests:true,approved:true };
const policy = { maxDurationMs:60000,maxMemoryMb:512,maxOutputBytes:1024,maxParallel:1,allowNetwork:false as const,isolationAttested:true,dependenciesAttested:true,secretsAbsentAttested:true };

describe('ATLAS sovereign runner execution planning — no process execution', () => {
  it('plans only allowlisted synthetic steps with explicit attestations', () => {
    const plan = planSovereignRunner(job,grant,policy);
    expect(plan.allowed).toBe(true);
    expect(plan.steps).toEqual(['gps5d-unit','gps5d-typecheck','gps5d-postgres']);
    expect(plan.cancellationToken).toBe('job-1:lease-1:1');
  });
  it.each([
    { allowNetwork:true }, { isolationAttested:false }, { dependenciesAttested:false },
    { secretsAbsentAttested:false }, { maxDurationMs:0 }, { maxDurationMs:1200001 },
    { maxMemoryMb:4097 }, { maxOutputBytes:10485761 }, { maxParallel:3 },
    { maxParallel:NaN }, { maxDurationMs:Infinity }
  ])('denies unsafe execution policy %#', patch => {
    const result = planSovereignRunner(job,grant,{...policy,...patch});
    expect(result.allowed).toBe(false);
    expect(result.steps).toEqual([]);
    expect(result.cancellationToken).toBeNull();
  });
  it('denies missing policy and revoked grants', () => {
    expect(planSovereignRunner(job,grant,null).allowed).toBe(false);
    expect(planSovereignRunner(job,{...grant,activeMember:false},policy).allowed).toBe(false);
  });
  it('rejects cancellation from stale leases or revoked members', () => {
    expect(canCancelPlannedJob(job,grant,'job-1:lease-1:1')).toBe(true);
    expect(canCancelPlannedJob(job,grant,'job-1:lease-old:1')).toBe(false);
    expect(canCancelPlannedJob(job,{...grant,activeMember:false},'job-1:lease-1:1')).toBe(false);
  });
});
