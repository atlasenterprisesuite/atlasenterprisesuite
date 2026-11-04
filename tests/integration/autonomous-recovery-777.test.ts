import { describe, expect, it } from 'vitest';
import { decideExpiredLeaseRecovery, type LeaseRecoveryInput } from '../../packages/execution/src/autonomous-recovery-777';
const base: LeaseRecoveryInput = { state: 'claimed', leaseExpiresAt: '2026-10-25T12:00:00Z', now: '2026-10-25T12:05:00Z', idempotent: true, verifiedNoSideEffects: true, attempt: 1, maxAttempts: 3 };
describe('Autonomous Executor 777 expired lease policy', () => {
  it('permits retry only with expiry and proven safety', () => expect(decideExpiredLeaseRecovery(base)).toBe('retry_eligible'));
  it('does not steal a live lease', () => expect(decideExpiredLeaseRecovery({ ...base, now: '2026-10-25T11:59:59Z' })).toBe('ignore'));
  it('quarantines actions with uncertain side effects', () => expect(decideExpiredLeaseRecovery({ ...base, verifiedNoSideEffects: false })).toBe('quarantine'));
  it('quarantines non-idempotent actions', () => expect(decideExpiredLeaseRecovery({ ...base, idempotent: false })).toBe('quarantine'));
  it('quarantines exhausted attempts and invalid expiry', () => {
    expect(decideExpiredLeaseRecovery({ ...base, attempt: 3 })).toBe('quarantine');
    expect(decideExpiredLeaseRecovery({ ...base, leaseExpiresAt: null })).toBe('quarantine');
  });
  it('never retries completed or cancelled jobs', () => {
    expect(decideExpiredLeaseRecovery({ ...base, state: 'completed' })).toBe('ignore');
    expect(decideExpiredLeaseRecovery({ ...base, state: 'cancelled' })).toBe('ignore');
  });
});
