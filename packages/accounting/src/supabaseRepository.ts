import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AccountWriteGateway,
  CreateAccountCommand,
  UpdateAccountCommand,
} from './accountWrites';
import type {
  ArApWriteGateway,
  RecordInvoicePaymentCommand,
  SetBillApprovalCommand,
} from './arApWrites';
import type {
  BankCashWriteGateway,
  CloseReconciliationCommand,
  ResolveReconciliationItemCommand,
  StartReconciliationCommand,
} from './bankCashWrites';
import type {
  CreatePostedJournalCommand,
  JournalWriteGateway,
  ReversePostedJournalCommand,
} from './journalWrites';
import {
  AccountingRepositoryImpl,
  type AccountingReadGateway,
  type AccountingRepository,
} from './repository';
import type { AccountingTable } from './types';

export class SupabaseAccountingReadGateway implements AccountingReadGateway {
  constructor(private readonly client: SupabaseClient) {}

  async select<T>(table: AccountingTable, columns: string, organizationId: string): Promise<T[]> {
    const { data, error } = await this.client
      .from(table)
      .select(columns)
      .eq('org_id', organizationId);

    if (error) {
      throw new Error(`Accounting query failed for ${table}: ${error.message}`);
    }

    return (data ?? []) as T[];
  }
}

export class SupabaseAccountWriteGateway implements AccountWriteGateway {
  constructor(private readonly client: Pick<SupabaseClient, 'rpc'>) {}

  async createAccount(command: CreateAccountCommand): Promise<string> {
    return this.runAccountRpc('create_chart_account', {
      organization_uuid: command.organizationId,
      account_code: command.accountNumber,
      account_name: command.name,
      account_kind: command.accountType,
    });
  }

  async updateAccount(command: UpdateAccountCommand): Promise<string> {
    return this.runAccountRpc('update_chart_account', {
      organization_uuid: command.organizationId,
      account_uuid: command.accountId,
      account_code: command.accountNumber,
      account_name: command.name,
      account_kind: command.accountType,
      account_active: command.active,
    });
  }

  private async runAccountRpc(
    functionName: 'create_chart_account' | 'update_chart_account',
    args: Record<string, unknown>,
  ): Promise<string> {
    const { data, error } = await this.client.rpc(functionName, args);
    if (error) throw new Error(error.message);
    if (typeof data !== 'string' || !data) throw new Error('Account write did not return an id');
    return data;
  }
}

export class SupabaseArApWriteGateway implements ArApWriteGateway {
  constructor(private readonly client: Pick<SupabaseClient, 'rpc'>) {}

  async recordInvoicePayment(command: RecordInvoicePaymentCommand): Promise<string> {
    return this.runArApRpc('record_invoice_payment', {
      invoice_uuid: command.invoiceId,
      payment_amount: command.amount,
      paid_on: command.paidOn,
    });
  }

  async setBillApprovalState(command: SetBillApprovalCommand): Promise<string> {
    return this.runArApRpc('set_accounting_bill_approval_state', {
      organization_uuid: command.organizationId,
      bill_uuid: command.billId,
      approval_state: command.approvalState,
    });
  }

  private async runArApRpc(
    functionName: 'record_invoice_payment' | 'set_accounting_bill_approval_state',
    args: Record<string, unknown>,
  ): Promise<string> {
    const { data, error } = await this.client.rpc(functionName, args);
    if (error) throw new Error(error.message);
    if (typeof data !== 'string' || !data) throw new Error('AR/AP write did not return an id');
    return data;
  }
}

export class SupabaseBankCashWriteGateway implements BankCashWriteGateway {
  constructor(private readonly client: Pick<SupabaseClient, 'rpc'>) {}

  async startReconciliation(command: StartReconciliationCommand): Promise<string> {
    return this.runBankCashRpc('start_accounting_reconciliation', {
      organization_uuid: command.organizationId,
      bank_account_uuid: command.bankAccountId,
      period_start_date: command.periodStart,
      period_end_date: command.periodEnd,
      statement_balance: command.statementEndingBalance,
      ledger_balance: command.ledgerEndingBalance,
    });
  }

  async resolveReconciliationItem(command: ResolveReconciliationItemCommand): Promise<string> {
    return this.runBankCashRpc('resolve_accounting_reconciliation_item', {
      organization_uuid: command.organizationId,
      item_uuid: command.itemId,
      item_status: command.status,
      item_match_type: command.matchType,
      item_variance: command.variance,
      item_note: command.note,
    });
  }

  async closeReconciliation(command: CloseReconciliationCommand): Promise<string> {
    return this.runBankCashRpc('close_accounting_reconciliation', {
      organization_uuid: command.organizationId,
      session_uuid: command.sessionId,
    });
  }

  private async runBankCashRpc(
    functionName:
      | 'start_accounting_reconciliation'
      | 'resolve_accounting_reconciliation_item'
      | 'close_accounting_reconciliation',
    args: Record<string, unknown>,
  ): Promise<string> {
    const { data, error } = await this.client.rpc(functionName, args);
    if (error) throw new Error(error.message);
    if (typeof data !== 'string' || !data) throw new Error('Bank/Cash write did not return an id');
    return data;
  }
}

export class SupabaseAccountingWriteGateway implements JournalWriteGateway {
  constructor(private readonly client: Pick<SupabaseClient, 'rpc'>) {}

  async createBalancedJournalEntry(command: CreatePostedJournalCommand): Promise<string> {
    return this.runJournalRpc('create_balanced_journal_entry', {
      organization_uuid: command.organizationId,
      entry_code: command.entryNumber,
      entry_on: command.entryDate,
      entry_memo: command.memo,
      debit_account_uuid: command.debitAccountId,
      credit_account_uuid: command.creditAccountId,
      entry_amount: command.amount,
    });
  }

  async reversePostedJournalEntry(command: ReversePostedJournalCommand): Promise<string> {
    return this.runJournalRpc('reverse_posted_journal_entry', {
      organization_uuid: command.organizationId,
      journal_uuid: command.journalEntryId,
      reversal_code: command.reversalEntryNumber,
      reversal_on: command.reversalDate,
      reversal_reason: command.reason,
    });
  }

  private async runJournalRpc(
    functionName: 'create_balanced_journal_entry' | 'reverse_posted_journal_entry',
    args: Record<string, unknown>,
  ): Promise<string> {
    const { data, error } = await this.client.rpc(functionName, args);

    if (error) {
      throw new Error(error.message);
    }

    if (typeof data !== 'string' || !data) {
      throw new Error('Journal write did not return an id');
    }

    return data;
  }
}

export function createSupabaseAccountingRepository(client: SupabaseClient): AccountingRepository {
  return new AccountingRepositoryImpl(new SupabaseAccountingReadGateway(client));
}
