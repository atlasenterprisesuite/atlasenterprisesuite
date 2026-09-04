import { describe, expect, it } from 'vitest';
import { InMemoryAuditSink } from '../../packages/core/src';
import { canUseHealthPermission, updateDemoHealthRecordStatus } from '../../packages/health/src';
import { healthOperations } from '../../data/demo/health';

describe('Health permissions and demo actions', () => {
  it('requires explicit permission', () => {
    expect(canUseHealthPermission(['health.read'], 'health.facilities.write')).toBe(false);
    expect(canUseHealthPermission(['health.admin'], 'health.facilities.write')).toBe(true);
  });

  it('rejects a facilities mutation without write permission', () => {
    const records = healthOperations.map(record => ({ ...record }));
    const result = updateDemoHealthRecordStatus({ records, auditSink: new InMemoryAuditSink(), recordId: 'facility-1', nextStatus: 'closed', granted: ['health.facilities.read'], actorId: 'viewer-1' });
    expect(result.ok).toBe(false);
  });

  it('audits an authorized demo mutation in the active shared scope', () => {
    const records = healthOperations.map(record => ({ ...record }));
    const sink = new InMemoryAuditSink();
    const result = updateDemoHealthRecordStatus({ records, auditSink: sink, recordId: 'facility-1', nextStatus: 'closed', granted: ['health.facilities.write'], actorId: 'operator-1' });
    expect(result.ok).toBe(true);
    expect(sink.list({ tenantId: 'tenant-demo', organizationId: 'org-demo' })).toHaveLength(1);
  });
});
