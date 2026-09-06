import { describe, expect, it } from 'vitest';
import {
  AccountingGovernanceWriteService,
  type AccountingGovernanceWriteGateway,
  type CloseAccountingPeriodCommand,
  type CreateFixedAssetCommand,
  type UpdateAccountingSettingsCommand,
} from '../../packages/accounting/src';

function gatewayWith(overrides: Partial<AccountingGovernanceWriteGateway> = {}): AccountingGovernanceWriteGateway {
  return {
    createFixedAsset: async () => 'asset-1',
    closeAccountingPeriod: async () => 'period-1',
    updateAccountingSettings: async () => 'org-1',
    ...overrides,
  };
}

describe('Task 8 accounting write service', () => {
  it('validates and normalizes fixed asset creation', async () => {
    let received: CreateFixedAssetCommand | undefined;
    const service = new AccountingGovernanceWriteService(gatewayWith({
      createFixedAsset: async (command) => {
        received = command;
        return 'asset-1';
      },
    }));

    await expect(service.createFixedAsset({
      organizationId: ' org-1 ',
      assetCode: ' fa-001 ',
      name: ' Server ',
      acquisitionDate: '2026-01-01',
      cost: 12000,
      salvageValue: 1000,
      usefulLifeMonths: 36,
    })).resolves.toBe('asset-1');

    expect(received).toEqual({
      organizationId: 'org-1',
      assetCode: 'FA-001',
      name: 'Server',
      acquisitionDate: '2026-01-01',
      cost: 12000,
      salvageValue: 1000,
      usefulLifeMonths: 36,
    });

    await expect(service.createFixedAsset({
      organizationId: 'org-1', assetCode: 'FA-2', name: 'Bad', acquisitionDate: '2026-01-01',
      cost: 100, salvageValue: 101, usefulLifeMonths: 12,
    })).rejects.toThrow(/salvage/i);
  });

  it('delegates period close without pretending frontend checks are authoritative', async () => {
    let received: CloseAccountingPeriodCommand | undefined;
    const service = new AccountingGovernanceWriteService(gatewayWith({
      closeAccountingPeriod: async (command) => {
        received = command;
        return command.periodId;
      },
    }));

    await expect(service.closeAccountingPeriod({ organizationId: ' org-1 ', periodId: ' period-1 ' }))
      .resolves.toBe('period-1');
    expect(received).toEqual({ organizationId: 'org-1', periodId: 'period-1' });
  });

  it('allows only operationally supported accounting settings', async () => {
    let received: UpdateAccountingSettingsCommand | undefined;
    const service = new AccountingGovernanceWriteService(gatewayWith({
      updateAccountingSettings: async (command) => {
        received = command;
        return command.organizationId;
      },
    }));

    await expect(service.updateAccountingSettings({
      organizationId: ' org-1 ',
      fiscalYearStart: '01-01',
      baseCurrency: 'usd',
      accountingBasis: 'accrual',
      defaultArAccountId: ' ar-1 ',
      defaultApAccountId: null,
    })).resolves.toBe('org-1');

    expect(received).toEqual({
      organizationId: 'org-1', fiscalYearStart: '01-01', baseCurrency: 'USD', accountingBasis: 'accrual',
      defaultArAccountId: 'ar-1', defaultApAccountId: null,
    });

    await expect(service.updateAccountingSettings({
      organizationId: 'org-1', fiscalYearStart: '13-01', baseCurrency: 'USD', accountingBasis: 'accrual',
      defaultArAccountId: null, defaultApAccountId: null,
    })).rejects.toThrow(/fiscal year/i);
  });
});
