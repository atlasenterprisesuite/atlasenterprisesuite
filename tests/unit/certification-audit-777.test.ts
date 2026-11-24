import { describe, expect, it, vi } from 'vitest';
import { reconcileCertification, type CertificationAuditEvent } from '../../packages/core/src/certificationAudit777';
const sha = 'a'.repeat(40);
const steps = ['unit', 'integration', 'typecheck', 'build', 'security', 'tenantIsolation'];
const checks = Object.fromEntries(steps.map((step, index) => [step, { sha, status: 'completed', conclusion: 'success', runId: index + 1 }]));
const input = { moduleId: 'atlas-pay', sha, checks, p0Open: false, authorized: true, authorizationRequired: true };
function store() {
  const events: CertificationAuditEvent[] = [];
  let prior: any = null;
  return {
    events,
    ledger: {
      load: vi.fn(async () => prior),
      appendIfAbsent: vi.fn(async (event: CertificationAuditEvent) => {
        if (events.some(e => e.eventId === event.eventId)) return false;
        events.push(event);
        return true;
      }),
      save: vi.fn(async (current: any) => { prior = current; })
    }
  };
}
describe('ATLAS certification audit contract', () => {
  it('records an approval milestone once with exact SHA', async () => {
    const f = store();
    expect((await reconcileCertification(input, f.ledger, '2026-10-26T00:00:00Z')).status).toBe('recorded');
    expect(f.events).toHaveLength(1);
    expect(f.events[0].sha).toBe(sha);
    await reconcileCertification(input, f.ledger, '2026-10-26T00:01:00Z');
    expect(f.events).toHaveLength(1);
  });
  it('does not claim success if audit persistence fails', async () => {
    const f = store();
    f.ledger.appendIfAbsent.mockResolvedValue(false);
    const result = await reconcileCertification(input, f.ledger, '2026-10-26T00:00:00Z');
    expect(result.status).toBe('blocked');
    expect(f.ledger.save).not.toHaveBeenCalled();
  });
  it('does not emit a milestone for open P0', async () => {
    const f = store();
    await reconcileCertification({ ...input, p0Open: true }, f.ledger, '2026-10-26T00:00:00Z');
    expect(f.events).toHaveLength(0);
  });
});
