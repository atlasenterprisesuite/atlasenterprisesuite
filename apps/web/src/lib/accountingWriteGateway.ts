import type {
  AccountWriteGateway,
  AccountingGovernanceWriteGateway,
  ArApWriteGateway,
  BankCashWriteGateway,
  CloseAccountingPeriodCommand,
  CloseReconciliationCommand,
  CreateAccountCommand,
  CreateFixedAssetCommand,
  CreatePostedJournalCommand,
  JournalWriteGateway,
  RecordInvoicePaymentCommand,
  ResolveReconciliationItemCommand,
  ReversePostedJournalCommand,
  SetBillApprovalCommand,
  StartReconciliationCommand,
  UpdateAccountingSettingsCommand,
  UpdateAccountCommand,
} from '../../../../packages/accounting/src';
import { atlasAccountingRpc, type AtlasAccountingRpcName } from './atlasSession';

export type AtlasAccountingRpcCaller = <T>(
  functionName: AtlasAccountingRpcName,
  args: Record<string, unknown>,
) => Promise<T>;

function requireWriteId(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Accounting write did not return an id');
  return value;
}

async function runIdRpc(
  rpc: AtlasAccountingRpcCaller,
  functionName: AtlasAccountingRpcName,
  args: Record<string, unknown>,
): Promise<string> {
  return requireWriteId(await rpc<unknown>(functionName, args));
}

export class AtlasRestAccountWriteGateway implements AccountWriteGateway {
  constructor(private readonly rpc: AtlasAccountingRpcCaller = atlasAccountingRpc) {}

  createAccount(command: CreateAccountCommand): Promise<string> {
    return runIdRpc(this.rpc, 'create_chart_account', {
      organization_uuid: command.organizationId,
      account_code: command.accountNumber,
      account_name: command.name,
      account_kind: command.accountType,
    });
  }

  updateAccount(command: UpdateAccountCommand): Promise<string> {
    return runIdRpc(this.rpc, 'update_chart_account', {
      organization_uuid: command.organizationId,
      account_uuid: command.accountId,
      account_code: command.accountNumber,
      account_name: command.name,
      account_kind: command.accountType,
      account_active: command.active,
    });
  }
}

export class AtlasRestJournalWriteGateway implements JournalWriteGateway {
  constructor(private readonly rpc: AtlasAccountingRpcCaller = atlasAccountingRpc) {}

  createBalancedJournalEntry(command: CreatePostedJournalCommand): Promise<string> {
    return runIdRpc(this.rpc, 'create_balanced_journal_entry', {
      organization_uuid: command.organizationId,
      entry_code: command.entryNumber,
      entry_on: command.entryDate,
      entry_memo: command.memo,
      debit_account_uuid: command.debitAccountId,
      credit_account_uuid: command.creditAccountId,
      entry_amount: command.amount,
    });
  }

  reversePostedJournalEntry(command: ReversePostedJournalCommand): Promise<string> {
    return runIdRpc(this.rpc, 'reverse_posted_journal_entry', {
      organization_uuid: command.organizationId,
      journal_uuid: command.journalEntryId,
      reversal_code: command.reversalEntryNumber,
      reversal_on: command.reversalDate,
      reversal_reason: command.reason,
    });
  }
}

export class AtlasRestArApWriteGateway implements ArApWriteGateway {
  constructor(private readonly rpc: AtlasAccountingRpcCaller = atlasAccountingRpc) {}

  recordInvoicePayment(command: RecordInvoicePaymentCommand): Promise<string> {
    return runIdRpc(this.rpc, 'record_invoice_payment', {
      invoice_uuid: command.invoiceId,
      payment_amount: command.amount,
      paid_on: command.paidOn,
    });
  }

  setBillApprovalState(command: SetBillApprovalCommand): Promise<string> {
    return runIdRpc(this.rpc, 'set_accounting_bill_approval_state', {
      organization_uuid: command.organizationId,
      bill_uuid: command.billId,
      approval_state: command.approvalState,
    });
  }
}

export class AtlasRestBankCashWriteGateway implements BankCashWriteGateway {
  constructor(private readonly rpc: AtlasAccountingRpcCaller = atlasAccountingRpc) {}

  startReconciliation(command: StartReconciliationCommand): Promise<string> {
    return runIdRpc(this.rpc, 'start_accounting_reconciliation', {
      organization_uuid: command.organizationId,
      bank_account_uuid: command.bankAccountId,
      period_start_date: command.periodStart,
      period_end_date: command.periodEnd,
      statement_balance: command.statementEndingBalance,
      ledger_balance: command.ledgerEndingBalance,
    });
  }

  resolveReconciliationItem(command: ResolveReconciliationItemCommand): Promise<string> {
    return runIdRpc(this.rpc, 'resolve_accounting_reconciliation_item', {
      organization_uuid: command.organizationId,
      item_uuid: command.itemId,
      item_status: command.status,
      item_match_type: command.matchType,
      item_variance: command.variance,
      item_note: command.note,
    });
  }

  closeReconciliation(command: CloseReconciliationCommand): Promise<string> {
    return runIdRpc(this.rpc, 'close_accounting_reconciliation', {
      organization_uuid: command.organizationId,
      session_uuid: command.sessionId,
    });
  }
}

export class AtlasRestGovernanceWriteGateway implements AccountingGovernanceWriteGateway {
  constructor(private readonly rpc: AtlasAccountingRpcCaller = atlasAccountingRpc) {}

  createFixedAsset(command: CreateFixedAssetCommand): Promise<string> {
    return runIdRpc(this.rpc, 'create_accounting_fixed_asset', {
      organization_uuid: command.organizationId,
      asset_code: command.assetCode,
      asset_name: command.name,
      acquired_on: command.acquisitionDate,
      asset_cost: command.cost,
      salvage_amount: command.salvageValue,
      useful_life_months: command.usefulLifeMonths,
    });
  }

  closeAccountingPeriod(command: CloseAccountingPeriodCommand): Promise<string> {
    return runIdRpc(this.rpc, 'close_accounting_period', {
      organization_uuid: command.organizationId,
      period_uuid: command.periodId,
    });
  }

  updateAccountingSettings(command: UpdateAccountingSettingsCommand): Promise<string> {
    return runIdRpc(this.rpc, 'set_accounting_settings', {
      organization_uuid: command.organizationId,
      fiscal_year_start_value: command.fiscalYearStart,
      base_currency_value: command.baseCurrency,
      accounting_basis_value: command.accountingBasis,
      default_ar_account_uuid: command.defaultArAccountId,
      default_ap_account_uuid: command.defaultApAccountId,
    });
  }
}
