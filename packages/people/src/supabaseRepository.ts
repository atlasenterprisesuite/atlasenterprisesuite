import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PeopleRepositoryImpl,
  type PeopleReadGateway,
  type PeopleRepository,
} from './repository';
import type {
  ApproveTimeEntryCommand,
  CreateTimeEntryCommand,
  PeopleTimeWriteGateway,
  RejectTimeEntryCommand,
  SubmitTimeEntryCommand,
} from './timeWrites';
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

export class SupabasePeopleTimeWriteGateway implements PeopleTimeWriteGateway {
  constructor(private readonly client: Pick<SupabaseClient, 'rpc'>) {}

  async createTimeEntry(command: CreateTimeEntryCommand): Promise<string> {
    return this.runTimeRpc('create_people_time_entry', {
      organization_uuid: command.organizationId,
      employee_uuid: command.employeeId,
      work_day: command.workDate,
      clock_in_at: command.clockIn,
      clock_out_at: command.clockOut,
      break_minutes_value: command.breakMinutes,
    });
  }

  async submitTimeEntry(command: SubmitTimeEntryCommand): Promise<string> {
    return this.runTimeRpc('submit_people_time_entry', {
      organization_uuid: command.organizationId,
      time_entry_uuid: command.timeEntryId,
    });
  }

  async approveTimeEntry(command: ApproveTimeEntryCommand): Promise<string> {
    return this.runTimeRpc('approve_people_time_entry', {
      organization_uuid: command.organizationId,
      time_entry_uuid: command.timeEntryId,
    });
  }

  async rejectTimeEntry(command: RejectTimeEntryCommand): Promise<string> {
    return this.runTimeRpc('reject_people_time_entry', {
      organization_uuid: command.organizationId,
      time_entry_uuid: command.timeEntryId,
    });
  }

  private async runTimeRpc(
    functionName:
      | 'create_people_time_entry'
      | 'submit_people_time_entry'
      | 'approve_people_time_entry'
      | 'reject_people_time_entry',
    args: Record<string, unknown>,
  ): Promise<string> {
    const { data, error } = await this.client.rpc(functionName, args);
    if (error) throw new Error(error.message);
    if (typeof data !== 'string' || !data) {
      throw new Error('People time write did not return an id');
    }
    return data;
  }
}

export function createSupabasePeopleRepository(client: SupabaseClient): PeopleRepository {
  return new PeopleRepositoryImpl(new SupabasePeopleReadGateway(client));
}
