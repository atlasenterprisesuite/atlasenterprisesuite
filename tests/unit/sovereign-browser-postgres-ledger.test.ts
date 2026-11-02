import { describe, expect, it, vi } from 'vitest';
import { createInternalBrowserLedger, type TrustedBrowserDatabase } from '../../packages/execution/src/browser-postgres-ledger';

const scope = {
  organizationId: 'org-A', tenantId: 'tenant-A', idempotencyKey: 'job-1',
  workflowId: 'workflow-A', stepId: 'step-A', actionDigest: 'a'.repeat(64),
};
function fixture(actor = 'user-A') {
  const query = vi.fn().mockResolvedValue({ rows: [{ reservation_id: 'reservation-A', accepted: true }] });
  const db: TrustedBrowserDatabase = {
    transaction: async run => run({ authenticatedActorId: actor, query }),
  };
  return { query, ledger: createInternalBrowserLedger(db) };
}
describe('Sovereign Browser internal PostgreSQL adapter', () => {
  it('reserves within a database transaction using scoped parameters', async () => {
    const { query, ledger } = fixture();
    await expect(ledger.reserve(scope)).resolves.toBe('reservation-A');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('atlas_browser_reserve_777'), [
      'org-A','tenant-A','job-1','workflow-A','step-A','a'.repeat(64),
    ]);
  });
  it('rejects a transaction without verified identity before executing SQL', async () => {
    const { query, ledger } = fixture('');
    await expect(ledger.reserve(scope)).rejects.toThrow('browser_invalid_actor');
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects empty database reservation responses', async () => {
    const { query, ledger } = fixture();
    query.mockResolvedValueOnce({ rows: [] });
    await expect(ledger.reserve(scope)).rejects.toThrow('browser_reservation_unconfirmed');
  });
  it('never permits a revoked terminal transition', async () => {
    const { query, ledger } = fixture();
    await expect(ledger.finish(scope,'reservation-A','revoked' as 'completed')).rejects.toThrow('browser_invalid_terminal_state');
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects unconfirmed completion and preserves tenant scope', async () => {
    const { query, ledger } = fixture();
    query.mockResolvedValueOnce({ rows: [{ accepted: false }] });
    await expect(ledger.finish(scope,'reservation-A','completed')).rejects.toThrow('browser_finish_unconfirmed');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('atlas_browser_finish_777'),
      ['reservation-A','org-A','tenant-A','job-1','a'.repeat(64),'completed']);
  });
});
