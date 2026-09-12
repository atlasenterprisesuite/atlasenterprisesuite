import { describe, expect, test } from 'vitest';
import type { AccountingTable } from '../../packages/accounting/src';
import {
  AtlasRestAccountingReadGateway,
  createAtlasAccountingRepository,
  type AtlasAccountingRestSelector,
} from '../../apps/web/src/lib/accountingRepository';

describe('ATLAS live Accounting REST boundary', () => {
  test('forwards the canonical table, columns and organization scope unchanged', async () => {
    const calls: Array<{ table: AccountingTable; columns: string; organizationId: string }> = [];
    const select: AtlasAccountingRestSelector = async <T>(table, columns, organizationId) => {
      calls.push({ table, columns, organizationId });
      return [] as T[];
    };
    const gateway = new AtlasRestAccountingReadGateway(select);

    await gateway.select('chart_of_accounts', 'id,org_id,account_number', 'org-live');

    expect(calls).toEqual([
      {
        table: 'chart_of_accounts',
        columns: 'id,org_id,account_number',
        organizationId: 'org-live',
      },
    ]);
  });

  test('creates the shared AccountingRepository on the authenticated REST transport', async () => {
    const select: AtlasAccountingRestSelector = async <T>() => [] as T[];
    const repository = createAtlasAccountingRepository(select);

    await expect(repository.listAccounts('org-live')).resolves.toEqual([]);
  });
});
