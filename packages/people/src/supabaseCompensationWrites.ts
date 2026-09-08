import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateCompensationCommand,
  PeopleCompensationWriteGateway,
  SetDeductionCommand,
} from './compensationWrites';

abstract class SupabaseCompensationRpcGateway {
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

export class SupabasePeopleCompensationWriteGateway
  extends SupabaseCompensationRpcGateway
  implements PeopleCompensationWriteGateway {
  async createCompensation(command: CreateCompensationCommand): Promise<string> {
    return this.runRpc('create_people_compensation', {
      organization_uuid: command.organizationId,
      employee_uuid: command.employeeId,
      pay_type_value: command.payType,
      hourly_rate_value: command.hourlyRate,
      annual_salary_value: command.annualSalary,
      effective_from_value: command.effectiveFrom,
      effective_to_value: command.effectiveTo,
    }, 'People compensation write');
  }

  async setDeduction(command: SetDeductionCommand): Promise<string> {
    return this.runRpc('set_people_deduction', {
      organization_uuid: command.organizationId,
      employee_uuid: command.employeeId,
      code_value: command.code,
      label_value: command.label,
      treatment_value: command.treatment,
      calculation_type_value: command.calculationType,
      amount_value: command.amount,
      active_value: command.active,
    }, 'People deduction write');
  }
}
