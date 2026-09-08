import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CompensationRepositoryImpl,
  type CompensationReadGateway,
  type CompensationRepository,
  type CompensationTable,
} from './compensationRepository';

export class SupabaseCompensationReadGateway implements CompensationReadGateway {
  constructor(private readonly client: SupabaseClient) {}

  async select<T>(table: CompensationTable, columns: string, organizationId: string): Promise<T[]> {
    const { data, error } = await this.client
      .from(table)
      .select(columns)
      .eq('org_id', organizationId);

    if (error) throw new Error(`Compensation query failed for ${table}: ${error.message}`);
    return (data ?? []) as T[];
  }
}

export function createSupabaseCompensationRepository(client: SupabaseClient): CompensationRepository {
  return new CompensationRepositoryImpl(new SupabaseCompensationReadGateway(client));
}
