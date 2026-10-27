import { describe, expect, it } from 'vitest';
import { authorizeRunnerJob, certifyRunnerReceipt, authorizeRunnerCancellation } from '../../packages/core/src/sovereignRunnerContract';

const job = { jobId:'job-1',tenantId:'tenant-a',requestedBy:'alice',repository:'atlasenterprisesuite/atlasenterprisesuite',commitSha:'a'.repeat(40),kind:'gps5d-synthetic-tdd' as const,leaseId:'lease-1',attempt:1,isolationEvidenceId:'iso-1',dependencyEvidenceId:'deps-1' };
const grant = { tenantId:'tenant-a',principalId:'alice',activeMember:true,canExecuteTests:true,approved:true };
const receipt = { jobId:job.jobId,tenantId:job.tenantId,commitSha:job.commitSha,leaseId:job.leaseId,attempt:1,status:'passed' as const,isolationVerified:true,dependenciesVerified:true,cleanupVerified:true,evidenceDigest:'b'.repeat(64) };

describe('ATLAS sovereign runner fail-closed policy — synthetic only', () => {
  it('accepts a structurally valid authorized synthetic job, without executing it', () => {
    expect(authorizeRunnerJob(job,grant)).toEqual({ allowed:true,reasons:[] });
  });
  it.each([
    [{tenantId:'tenant-b'},grant],
    [job,{...grant,activeMember:false}],
    [job,{...grant,canExecuteTests:false}],
    [job,{...grant,approved:false}],
    [job,{...grant,principalId:'mallory'}],
    [{...job,commitSha:'main'},grant],
    [{...job,leaseId:''},grant],
    [{...job,attempt:0},grant],
    [{...job,kind:'shell'},grant],
    [{...job,repository:'../../evil'},grant],
    [{...job,isolationEvidenceId:''},grant],
    [{...job,dependencyEvidenceId:''},grant]
  ])('denies unauthorized or malformed job %#', (j,g) => {
    expect(authorizeRunnerJob(j,g).allowed).toBe(false);
  });
  it('rejects missing job and missing grant', () => {
    expect(authorizeRunnerJob(null,grant).allowed).toBe(false);
    expect(authorizeRunnerJob(job,null).allowed).toBe(false);
  });
  it('requires all receipt evidence gates, matching tenant, lease, attempt and SHA', () => {
    expect(certifyRunnerReceipt(job,receipt)).toBe(true);
    for (const patch of [
      { tenantId:'tenant-b' }, { commitSha:'c'.repeat(40) }, { leaseId:'lease-old' },
      { attempt:2 }, { status:'failed' }, { status:'cancelled' },
      { isolationVerified:false }, { dependenciesVerified:false }, { cleanupVerified:false },
      { evidenceDigest:'bad' }
    ]) expect(certifyRunnerReceipt(job,{...receipt,...patch} as typeof receipt)).toBe(false);
    expect(certifyRunnerReceipt(job,null)).toBe(false);
  });
  it('rejects cancellation by a stale lease or revoked principal', () => {
    expect(authorizeRunnerCancellation(job,grant,'lease-1')).toBe(true);
    expect(authorizeRunnerCancellation(job,grant,'lease-old')).toBe(false);
    expect(authorizeRunnerCancellation(job,{...grant,activeMember:false},'lease-1')).toBe(false);
  });
});
