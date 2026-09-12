import { describe, expect, test } from 'vitest';
import {
  AccountingRepositoryImpl,
  type AccountingReadGateway,
  type AccountingTable,
} from '../../packages/accounting/src';

class ForecastGateway implements AccountingReadGateway {
  readonly calls: Array<{ table: AccountingTable; columns: string; organizationId: string }> = [];

  constructor(private readonly rows: unknown[] = []) {}

  async select<T>(table: AccountingTable, columns: string, organizationId: string): Promise<T[]> {
    this.calls.push({ table, columns, organizationId });
    return this.rows as T[];
  }
}

describe('Accounting forecast repository', () => {
  test('reads forecast snapshots from the canonical organization-scoped table', async () => {
    const gateway = new ForecastGateway([
      {
        id: 'forecast-1',
        org_id: 'org-1',
        entity_id: null,
        as_of_date: '2026-09-12',
        horizon_weeks: 13,
        scenario: 'base',
        forecast: { currency: 'USD', ending_cash: 125000 },
        assumptions: { collections_days: 32 },
        created_by: 'user-1',
        created_at: '2026-09-12T06:00:00Z',
      },
    ]);
    const repository = new AccountingRepositoryImpl(gateway);

    await expect(repository.listForecastSnapshots('org-1')).resolves.toEqual([
      {
        id: 'forecast-1',
        organizationId: 'org-1',
        entityId: null,
        asOfDate: '2026-09-12',
        horizonWeeks: 13,
        scenario: 'base',
        forecast: { currency: 'USD', ending_cash: 125000 },
        assumptions: { collections_days: 32 },
        createdBy: 'user-1',
        createdAt: '2026-09-12T06:00:00Z',
      },
    ]);
    expect(gateway.calls).toEqual([
      {
        table: 'accounting_forecast_snapshots',
        columns: 'id,org_id,entity_id,as_of_date,horizon_weeks,scenario,forecast,assumptions,created_by,created_at',
        organizationId: 'org-1',
      },
    ]);
  });
});
