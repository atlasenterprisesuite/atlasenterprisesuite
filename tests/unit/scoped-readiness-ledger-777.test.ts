import { describe, expect, it, vi } from 'vitest';
import { scopedReadinessLedger } from '../../packages/core/src/scopedReadinessLedger777';
import type { CertificationAuditEvent } from '../../packages/core/src/certificationAudit777';
import type { ReadinessResult } from '../../packages/core/src/integrationReadiness777';

const event: CertificationAuditEvent = {
  eventId: 'atlas-pay:' + 'a'.repeat(40) + ':blocked:authorization_blocker',
  moduleId: 'atlas-pay', sha: 'a'.repeat(40), state: 'blocked',
  blockers: ['P0_OPEN'], kind: 'authorization_blocker', createdAt: '2026-10-26T00:00:00Z'
};
function fixture() {
  const store = {
    load: vi.fn(async (_org: string, _module: string): Promise<ReadinessResult | null> => null),
    appendIfAbsent: vi.fn(async (_org: string, _event: CertificationAuditEvent) => true),
    save: vi.fn(async (_org: string, _result: ReadinessResult) => {})
  };
  return store;
}
describe('tenant-scoped readiness ledger boundary', () => {
  it('rejects an empty or ambiguous organization scope', () => {
    const store = fixture();
    expect(() => scopedReadinessLedger('', store)).toThrow('INVALID_ORGANIZATION_SCOPE');
    expect(() => scopedReadinessLedger(' org-a ', store)).toThrow('INVALID_ORGANIZATION_SCOPE');
  });
  it('prefixes audit idempotency keys by organization', async () => {
    const store = fixture();
    await scopedReadinessLedger('org-a', store).appendIfAbsent(event);
    await scopedReadinessLedger('org-b', store).appendIfAbsent(event);
    expect(store.appendIfAbsent).toHaveBeenNthCalledWith(1, 'org-a', expect.objectContaining({ eventId: 'org-a:' + event.eventId }));
    expect(store.appendIfAbsent).toHaveBeenNthCalledWith(2, 'org-b', expect.objectContaining({ eventId: 'org-b:' + event.eventId }));
    expect(event.eventId.startsWith('org-')).toBe(false);
  });
  it('never loads another organization through the same bound ledger', async () => {
    const store = fixture();
    await scopedReadinessLedger('org-a', store).load('atlas-pay');
    expect(store.load).toHaveBeenCalledExactlyOnceWith('org-a', 'atlas-pay');
  });
  it('propagates persistence failures without claiming a write', async () => {
    const store = fixture();
    store.appendIfAbsent.mockRejectedValue(new Error('storage offline'));
    await expect(scopedReadinessLedger('org-a', store).appendIfAbsent(event)).rejects.toThrow('storage offline');
    expect(store.save).not.toHaveBeenCalled();
  });
});
