import type { SupabaseClient } from '@supabase/supabase-js';
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

export function createSupabaseAccountingRepository(client: SupabaseClient): AccountingRepository {
  return new AccountingRepositoryImpl(new SupabaseAccountingReadGateway(client));
}
