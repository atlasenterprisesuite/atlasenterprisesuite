import type { SupabaseClient } from '@supabase/supabase-js';
import {
  RecruitingRepositoryImpl,
  type RecruitingReadGateway,
  type RecruitingRepository,
  type RecruitingTable,
} from './recruitingRepository';

export class SupabaseRecruitingReadGateway implements RecruitingReadGateway {
  constructor(private readonly client: SupabaseClient) {}

  async select<T>(table: RecruitingTable, columns: string, organizationId: string): Promise<T[]> {
    const { data, error } = await this.client
      .from(table)
      .select(columns)
      .eq('org_id', organizationId);

    if (error) throw new Error(`Recruiting query failed for ${table}: ${error.message}`);
    return (data ?? []) as T[];
  }
}

export function createSupabaseRecruitingRepository(client: SupabaseClient): RecruitingRepository {
  return new RecruitingRepositoryImpl(new SupabaseRecruitingReadGateway(client));
}
