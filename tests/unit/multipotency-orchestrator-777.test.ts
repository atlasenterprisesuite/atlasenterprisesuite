import { describe, expect, it } from 'vitest';
import { planMultipotency777, type MultipotencyTask777 } from '../../packages/core/src/multipotencyOrchestrator777';

const SHA = 'a'.repeat(40);
const task = (id: string, domain: MultipotencyTask777['domain'], priority: MultipotencyTask777['priority'] = 'P1'): MultipotencyTask777 => ({
  id, domain, priority, organizationId: 'org-a', tenantId: 'tenant-a', targetSha: SHA,
  idempotencyKey: id, leaseId: 'lease-' + id, leaseValid: true, auditReceiptId: 'audit-' + id,
  membershipActive: true, actorRole: 'admin', evidenceVerified: true, dependsOn: []
});
const scope = { organizationId: 'org-a', tenantId: 'tenant-a', sha: SHA, maxConcurrent: 2 };
describe('ATLAS multipotency deterministic fail-closed planner', () => {
  it('limits concurrency and prioritizes P0 across six domains', () => {
    const tasks = [
      task('learning','learning','P3'),task('intelligence','intelligence','P2'),
      task('development','development','P0'),task('security','security','P0'),
      task('verification','verification','P1'),task('recovery','recovery','P1')
    ];
    expect(planMultipotency777(tasks, scope).ready.map(t=>t.id)).toEqual(['development','security']);
  });
  it('rejects cross tenant, invalid SHA and revoked RBAC', () => {
    const tasks = [{...task('a','security'), tenantId:'tenant-b'},
      {...task('b','development'),targetSha:'b'.repeat(40)},
      {...task('c','verification'),membershipActive:false},
      {...task('d','recovery'),actorRole:'viewer'}];
    expect(planMultipotency777(tasks,scope).ready).toHaveLength(0);
  });
  it('rejects lease loss, missing audit, duplicate idempotency and duplicate IDs', () => {
    const tasks = [{...task('a','development'),leaseValid:false},
      {...task('b','security'),auditReceiptId:''},
      task('c','learning'), {...task('d','recovery'),idempotencyKey:'c'},
      task('e','intelligence'), {...task('e','verification'),idempotencyKey:'other'}];
    expect(planMultipotency777(tasks,scope).ready).toHaveLength(0);
  });
  it('blocks dependent tasks until prior task completion is independently verified', () => {
    const a=task('a','development');
    const b={...task('b','verification'),dependsOn:['a']};
    expect(planMultipotency777([a,b],{...scope,maxConcurrent:2}).ready.map(t=>t.id)).toEqual(['a']);
    expect(planMultipotency777([a,b],{...scope,completedTaskIds:['a']}).ready.map(t=>t.id)).toEqual(['a','b']);
  });
  it('fails closed for invalid limits and unverified evidence', () => {
    expect(planMultipotency777([task('a','security')],{...scope,maxConcurrent:0}).ready).toHaveLength(0);
    expect(planMultipotency777([{...task('a','security'),evidenceVerified:false}],scope).ready).toHaveLength(0);
  });
});
