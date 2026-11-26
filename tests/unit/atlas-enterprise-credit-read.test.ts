import { describe, expect, it, vi } from 'vitest';
import { readEnterpriseCreditStatus } from '../../supabase/functions/atlas-execution/enterprise-credit-read';

function subject() {
  return { orgId: 'org-a', userId: 'user-a', permissions: ['execution.read'] };
}
function fake(result: { data?: unknown; error?: unknown }) {
  const filters: Array<[string, string]> = [];
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((key: string, val: string) => { filters.push([key, val]); return query; }),
    maybeSingle: vi.fn(async () => result)
  };
  return { admin: { from: vi.fn(() => query) }, query, filters };
}
const account = {
  window_id: '2026-11',
  limit_credits: 11,
  reserved_credits: 3,
  spent_credits: 5,
  enabled: true
};
describe('ATLAS Enterprise credit authority read boundary', () => {
  it('reads canonical ledger scope ONLY from authenticated actor', async () => {
    const db = fake({ data: account, error: null });
    const status = await readEnterpriseCreditStatus({ admin: db.admin, context: subject(), now: new Date('2026-11-26') });
    expect(db.admin.from).toHaveBeenCalledWith('atlas_enterprise_credit_accounts');
    expect(db.filters).toEqual([
      ['org_id', 'org-a'], ['user_id', 'user-a'], ['window_id', '2026-11']
    ]);
    expect(status).toEqual({
      source: 'atlas_enterprise_credit_accounts',
      status: 'allocated', period: '2026-11',
      limitCredits: 11, reservedCredits: 3, spentCredits: 5, availableCredits: 3,
      paidExecutionEnabled: false
    });
  });

  it('distinguishes unconfigured account from schema not deployed', async () => {
    const noRow = fake({ data: null, error: null });
    expect((await readEnterpriseCreditStatus({ admin: noRow.admin, context: subject(), now: new Date('2026-11-26') })).status).toBe('unconfigured');
    const noSchema = fake({ data: null, error: { code: 'PGRST205' } });
    expect((await readEnterpriseCreditStatus({ admin: noSchema.admin, context: subject(), now: new Date('2026-11-26') })).status).toBe('not_installed');
  });

  it('does not report spend as enabled from an allocated or disabled account', async () => {
    for (const enabled of [true, false]) {
      const db = fake({ data: { ...account, enabled }, error: null });
      expect((await readEnterpriseCreditStatus({ admin: db.admin, context: subject(), now: new Date('2026-11-26') })).paidExecutionEnabled).toBe(false);
    }
  });

  it('denies unauthorized identities before querying the DB', async () => {
    for (const context of [{ ...subject(), userId: '' }, { ...subject(), permissions: [] }]) {
      const db = fake({ data: account, error: null });
      await expect(readEnterpriseCreditStatus({ admin: db.admin, context, now: new Date('2026-11-26') }))
        .rejects.toMatchObject({ status: 403 });
      expect(db.admin.from).not.toHaveBeenCalled();
    }
  });

  it('fails closed on malformed counts and unexpected DB failures', async () => {
    for (const result of [
      { data: { ...account, spent_credits: 12 }, error: null },
      { data: { ...account, reserved_credits: -1 }, error: null },
      { data: { ...account, limit_credits: '90071992547409999' }, error: null },
      { data: account, error: { code: '42501' } }
    ]) {
      const db = fake(result);
      await expect(readEnterpriseCreditStatus({ admin: db.admin, context: subject(), now: new Date('2026-11-26') })).rejects.toThrow();
    }
  });
});
