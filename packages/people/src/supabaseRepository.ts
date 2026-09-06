import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PeopleRepositoryImpl,
  type PeopleReadGateway,
  type PeopleRepository,
} from './repository';
import type { PeopleTable } from './types';

export class SupabasePeopleReadGateway implements PeopleReadGateway {
  constructor(private readonly client: SupabaseClient) {}

  async select<T>(table: PeopleTable, columns: string, organizationId: string): Promise<T[]> {
    const { data, error } = await this.client
      .from(table)
      .select(columns)
      .eq('org_id', organizationId);

    if (error) {
      throw new Error(`People query failed for ${table}: ${error.message}`);
    }

    return (data ?? []) as T[];
  }
}

export function createSupabasePeopleRepository(client: SupabaseClient): PeopleRepository {
  return new PeopleRepositoryImpl(new SupabasePeopleReadGateway(client));
}
