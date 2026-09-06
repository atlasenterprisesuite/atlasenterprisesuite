import { describe, expect, test } from 'vitest';
import {
  SupabaseAccountingGovernanceWriteGateway,
  type CloseAccountingPeriodCommand,
  type CreateFixedAssetCommand,
  type UpdateAccountingSettingsCommand,
} from '../../packages/accounting/src';

type RpcCall = { name: string; args: Record<string, unknown> };

function clientWith(result: { data: unknown; error: { message: string } | null }, calls: RpcCall[]) {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return result;
    },
  };
}

describe('Task 8 Supabase RPC gateway', () => {
  test('maps fixed asset creation to the governed RPC', async () => {
    const calls: RpcCall[] = [];
    const gateway = new SupabaseAccountingGovernanceWriteGateway(clientWith({ data: 'asset-1', error: null }, calls) as never);
    const command: CreateFixedAssetCommand = {
      organizationId: 'org-1', assetCode: 'FA-001', name: 'Server', acquisitionDate: '2026-01-01',
      cost: 12000, salvageValue: 1000, usefulLifeMonths: 36,
    };

    await expect(gateway.createFixedAsset(command)).resolves.toBe('asset-1');
    expect(calls).toEqual([{ name: 'create_accounting_fixed_asset', args: {
      organization_uuid: 'org-1', asset_code: 'FA-001', asset_name: 'Server', acquired_on: '2026-01-01',
      asset_cost: 12000, salvage_amount: 1000, useful_life_months: 36,
    } }]);
  });

  test('maps close and settings to governed RPCs', async () => {
    const calls: RpcCall[] = [];
    const gateway = new SupabaseAccountingGovernanceWriteGateway(clientWith({ data: 'record-1', error: null }, calls) as never);
    const close: CloseAccountingPeriodCommand = { organizationId: 'org-1', periodId: 'period-1' };
    const settings: UpdateAccountingSettingsCommand = {
      organizationId: 'org-1', fiscalYearStart: '01-01', baseCurrency: 'USD', accountingBasis: 'accrual',
      defaultArAccountId: 'ar-1', defaultApAccountId: 'ap-1',
    };

    await gateway.closeAccountingPeriod(close);
    await gateway.updateAccountingSettings(settings);

    expect(calls[0]).toEqual({ name: 'close_accounting_period', args: {
      organization_uuid: 'org-1', period_uuid: 'period-1',
    } });
    expect(calls[1]).toEqual({ name: 'set_accounting_settings', args: {
      organization_uuid: 'org-1', fiscal_year_start_value: '01-01', base_currency_value: 'USD',
      accounting_basis_value: 'accrual', default_ar_account_uuid: 'ar-1', default_ap_account_uuid: 'ap-1',
    } });
  });

  test('propagates RPC errors and rejects missing ids', async () => {
    const blocked = new SupabaseAccountingGovernanceWriteGateway(clientWith({ data: null, error: { message: 'blocked' } }, []) as never);
    await expect(blocked.closeAccountingPeriod({ organizationId: 'org-1', periodId: 'period-1' })).rejects.toThrow('blocked');

    const missing = new SupabaseAccountingGovernanceWriteGateway(clientWith({ data: null, error: null }, []) as never);
    await expect(missing.closeAccountingPeriod({ organizationId: 'org-1', periodId: 'period-1' }))
      .rejects.toThrow('Accounting governance write did not return an id');
  });
});
