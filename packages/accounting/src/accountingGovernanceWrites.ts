import { straightLineSchedule } from './assets';

export interface CreateFixedAssetCommand {
  organizationId: string;
  assetCode: string;
  name: string;
  acquisitionDate: string;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
}

export interface CloseAccountingPeriodCommand {
  organizationId: string;
  periodId: string;
}

export interface UpdateAccountingSettingsCommand {
  organizationId: string;
  fiscalYearStart: string;
  baseCurrency: string;
  accountingBasis: 'accrual';
  defaultArAccountId: string | null;
  defaultApAccountId: string | null;
}

export interface AccountingGovernanceWriteGateway {
  createFixedAsset(command: CreateFixedAssetCommand): Promise<string>;
  closeAccountingPeriod(command: CloseAccountingPeriodCommand): Promise<string>;
  updateAccountingSettings(command: UpdateAccountingSettingsCommand): Promise<string>;
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function optionalId(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeFiscalYearStart(value: string): string {
  const normalized = required(value, 'Fiscal year start');
  const match = /^(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) throw new Error('Fiscal year start must use MM-DD');

  const month = Number(match[1]);
  const day = Number(match[2]);
  const probe = new Date(Date.UTC(2000, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new Error('Fiscal year start is invalid');
  }
  return normalized;
}

function normalizeCurrency(value: string): string {
  const normalized = required(value, 'Base currency').toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new Error('Base currency must be a three-letter currency code');
  return normalized;
}

export class AccountingGovernanceWriteService {
  constructor(private readonly gateway: AccountingGovernanceWriteGateway) {}

  async createFixedAsset(command: CreateFixedAssetCommand): Promise<string> {
    const normalized: CreateFixedAssetCommand = {
      organizationId: required(command.organizationId, 'Organization'),
      assetCode: required(command.assetCode, 'Asset code').toUpperCase(),
      name: required(command.name, 'Asset name'),
      acquisitionDate: required(command.acquisitionDate, 'Acquisition date'),
      cost: command.cost,
      salvageValue: command.salvageValue,
      usefulLifeMonths: command.usefulLifeMonths,
    };

    straightLineSchedule({
      cost: normalized.cost,
      salvageValue: normalized.salvageValue,
      usefulLifeMonths: normalized.usefulLifeMonths,
      acquisitionDate: normalized.acquisitionDate,
    });

    return this.gateway.createFixedAsset(normalized);
  }

  async closeAccountingPeriod(command: CloseAccountingPeriodCommand): Promise<string> {
    return this.gateway.closeAccountingPeriod({
      organizationId: required(command.organizationId, 'Organization'),
      periodId: required(command.periodId, 'Accounting period'),
    });
  }

  async updateAccountingSettings(command: UpdateAccountingSettingsCommand): Promise<string> {
    if (command.accountingBasis !== 'accrual') {
      throw new Error('Only accrual accounting is operationally supported');
    }

    return this.gateway.updateAccountingSettings({
      organizationId: required(command.organizationId, 'Organization'),
      fiscalYearStart: normalizeFiscalYearStart(command.fiscalYearStart),
      baseCurrency: normalizeCurrency(command.baseCurrency),
      accountingBasis: 'accrual',
      defaultArAccountId: optionalId(command.defaultArAccountId),
      defaultApAccountId: optionalId(command.defaultApAccountId),
    });
  }
}
