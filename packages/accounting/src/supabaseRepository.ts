import type { SupabaseClient } from '@supabase/supabase-js';
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
