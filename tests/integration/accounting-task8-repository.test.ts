import { describe, expect, test } from 'vitest';
import {
  AccountingRepositoryImpl,
  type AccountingReadGateway,
  type AccountingTable,
} from '../../packages/accounting/src';

class RecordingGateway implements AccountingReadGateway {
  readonly calls: Array<{ table: AccountingTable; columns: string; organizationId: string }> = [];

  constructor(private readonly rows: Partial<Record<AccountingTable, unknown[]>> = {}) {}

  async select<T>(table: AccountingTable, columns: string, organizationId: string): Promise<T[]> {
    this.calls.push({ table, columns, organizationId });
    return (this.rows[table] ?? []) as T[];
  }
}

describe('Task 8 accounting repository', () => {
  test('maps fixed assets, periods, and close tasks in organization scope', async () => {
    const gateway = new RecordingGateway({
      accounting_fixed_assets: [{
        id: 'asset-1', org_id: 'org-1', entity_id: null, asset_code: 'FA-001', name: 'Server',
        description: null, acquisition_date: '2026-01-01', cost: 12000, salvage_value: 0,
        useful_life_months: 36, depreciation_method: 'straight_line', status: 'active',
        accumulated_depreciation: 1000, disposal_date: null, created_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
      }],
      accounting_periods: [{
        id: 'period-1', org_id: 'org-1', entity_id: null, period_start: '2026-08-01',
        period_end: '2026-08-31', status: 'closing', close_readiness: 75,
        filing_readiness: 50, closed_by: null, closed_at: null,
        created_at: '2026-08-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
      }],
      accounting_close_tasks: [{
        id: 'task-1', org_id: 'org-1', period_id: 'period-1', task_key: 'reconcile-bank',
        name: 'Reconcile bank accounts', task_group: 'reconciliation', owner_id: null,
        owner_label: 'Accounting', status: 'complete', blocker: null, due_at: null,
        weight: 20, evidence: {}, completed_at: '2026-09-01T00:00:00Z',
        created_at: '2026-08-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
      }],
    });
    const repository = new AccountingRepositoryImpl(gateway);

    await expect(repository.listFixedAssets('org-1')).resolves.toEqual([
      expect.objectContaining({ id: 'asset-1', assetCode: 'FA-001', cost: 12000, usefulLifeMonths: 36 }),
    ]);
    await expect(repository.listAccountingPeriods('org-1')).resolves.toEqual([
      expect.objectContaining({ id: 'period-1', status: 'closing', closeReadiness: 75 }),
    ]);
    await expect(repository.listCloseTasks('org-1')).resolves.toEqual([
      expect.objectContaining({ id: 'task-1', periodId: 'period-1', status: 'complete' }),
    ]);

    expect(gateway.calls.map((call) => call.table)).toEqual([
      'accounting_fixed_assets',
      'accounting_periods',
      'accounting_close_tasks',
    ]);
    expect(gateway.calls.every((call) => call.organizationId === 'org-1')).toBe(true);
  });

  test('reads accounting settings from the organization settings namespace', async () => {
    const repository = new AccountingRepositoryImpl(new RecordingGateway({
      organization_settings: [{
        org_id: 'org-1',
        settings: {
          accounting: {
            fiscal_year_start: '01-01',
            base_currency: 'USD',
            accounting_basis: 'accrual',
            default_ar_account_id: 'ar-1',
            default_ap_account_id: 'ap-1',
          },
        },
      }],
    }));

    await expect(repository.getAccountingSettings('org-1')).resolves.toEqual({
      organizationId: 'org-1',
      fiscalYearStart: '01-01',
      baseCurrency: 'USD',
      accountingBasis: 'accrual',
      defaultArAccountId: 'ar-1',
      defaultApAccountId: 'ap-1',
      configured: true,
    });
  });

  test('returns explicit unconfigured accounting defaults instead of invented organization data', async () => {
    const repository = new AccountingRepositoryImpl(new RecordingGateway());

    await expect(repository.getAccountingSettings('org-1')).resolves.toEqual({
      organizationId: 'org-1',
      fiscalYearStart: '01-01',
      baseCurrency: 'USD',
      accountingBasis: 'accrual',
      defaultArAccountId: null,
      defaultApAccountId: null,
      configured: false,
    });
  });
});
