import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreatePayrollRunCommand,
  PeoplePayrollWriteGateway,
  PayrollRunCommand,
  PersistPayrollLineCommand,
  VoidPayrollRunCommand,
} from './payrollWrites';
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

abstract class SupabasePeopleRpcGateway {
  constructor(protected readonly client: Pick<SupabaseClient, 'rpc'>) {}

  protected async runRpc(
    functionName: string,
    args: Record<string, unknown>,
    resultLabel: string,
  ): Promise<string> {
    const { data, error } = await this.client.rpc(functionName, args);
    if (error) throw new Error(error.message);
    if (typeof data !== 'string' || !data) {
      throw new Error(`${resultLabel} did not return an id`);
    }
    return data;
  }
}

export class SupabasePeopleTimeWriteGateway
  extends SupabasePeopleRpcGateway
  implements PeopleTimeWriteGateway {
  async createTimeEntry(command: CreateTimeEntryCommand): Promise<string> {
    return this.runRpc('create_people_time_entry', {
      organization_uuid: command.organizationId,
      employee_uuid: command.employeeId,
      work_day: command.workDate,
      clock_in_at: command.clockIn,
      clock_out_at: command.clockOut,
      break_minutes_value: command.breakMinutes,
    }, 'People time write');
  }

  async submitTimeEntry(command: SubmitTimeEntryCommand): Promise<string> {
    return this.runRpc('submit_people_time_entry', {
      organization_uuid: command.organizationId,
      time_entry_uuid: command.timeEntryId,
    }, 'People time write');
  }

  async approveTimeEntry(command: ApproveTimeEntryCommand): Promise<string> {
    return this.runRpc('approve_people_time_entry', {
      organization_uuid: command.organizationId,
      time_entry_uuid: command.timeEntryId,
    }, 'People time write');
  }

  async rejectTimeEntry(command: RejectTimeEntryCommand): Promise<string> {
    return this.runRpc('reject_people_time_entry', {
      organization_uuid: command.organizationId,
      time_entry_uuid: command.timeEntryId,
    }, 'People time write');
  }
}

export class SupabasePeoplePayrollWriteGateway
  extends SupabasePeopleRpcGateway
  implements PeoplePayrollWriteGateway {
  async createPayrollRun(command: CreatePayrollRunCommand): Promise<string> {
    return this.runRpc('create_people_payroll_run', {
      organization_uuid: command.organizationId,
      period_start_date: command.periodStart,
      period_end_date: command.periodEnd,
      pay_date_value: command.payDate,
    }, 'People payroll write');
  }

  async savePayrollLine(command: PersistPayrollLineCommand): Promise<string> {
    const input = command.calculationInput;
    return this.runRpc('upsert_people_payroll_line', {
      organization_uuid: command.organizationId,
      payroll_run_uuid: command.payrollRunId,
      employee_uuid: command.employeeId,
      regular_hours_value: input.regularHours,
      overtime_hours_value: input.overtimeHours,
      hourly_rate_value: input.hourlyRate,
      overtime_multiplier_value: input.overtimeMultiplier,
      salary_period_amount_value: input.salaryPeriodAmount,
      pretax_deductions_value: input.pretaxDeductions,
      taxes_withheld_value: input.taxesWithheld,
      posttax_deductions_value: input.posttaxDeductions,
      client_gross_pay: command.calculation.grossPay,
      client_net_pay: command.calculation.netPay,
    }, 'People payroll line write');
  }

  async calculatePayrollRun(command: PayrollRunCommand): Promise<string> {
    return this.runRunRpc('calculate_people_payroll_run', command);
  }

  async approvePayrollRun(command: PayrollRunCommand): Promise<string> {
    return this.runRunRpc('approve_people_payroll_run', command);
  }

  async lockPayrollRun(command: PayrollRunCommand): Promise<string> {
    return this.runRunRpc('lock_people_payroll_run', command);
  }

  async voidPayrollRun(command: VoidPayrollRunCommand): Promise<string> {
    return this.runRpc('void_people_payroll_run', {
      organization_uuid: command.organizationId,
      payroll_run_uuid: command.payrollRunId,
      void_reason_value: command.reason,
    }, 'People payroll write');
  }

  private async runRunRpc(functionName: string, command: PayrollRunCommand): Promise<string> {
    return this.runRpc(functionName, {
      organization_uuid: command.organizationId,
      payroll_run_uuid: command.payrollRunId,
    }, 'People payroll write');
  }
}

export function createSupabasePeopleRepository(client: SupabaseClient): PeopleRepository {
  return new PeopleRepositoryImpl(new SupabasePeopleReadGateway(client));
}
