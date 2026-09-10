import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PeopleEmployeeWriteGateway,
  UpdateEmployeeCommand,
} from './employeeWrites';
import type { EmployeeMutation } from './types';

export class SupabasePeopleEmployeeWriteGateway implements PeopleEmployeeWriteGateway {
  constructor(private readonly client: Pick<SupabaseClient, 'rpc'>) {}

  async createEmployee(command: EmployeeMutation): Promise<string> {
    return this.runRpc('create_people_employee', {
      organization_uuid: command.scope.organizationId,
      full_name_value: command.fullName,
      department_value: command.department,
      job_title_value: command.jobTitle,
      status_value: command.status,
    });
  }

  async updateEmployee(command: UpdateEmployeeCommand): Promise<string> {
    return this.runRpc('update_people_employee', {
      organization_uuid: command.scope.organizationId,
      employee_uuid: command.employeeId,
      full_name_value: command.fullName,
      department_value: command.department,
      job_title_value: command.jobTitle,
      status_value: command.status,
    });
  }

  private async runRpc(functionName: string, args: Record<string, unknown>): Promise<string> {
    const { data, error } = await this.client.rpc(functionName, args);
    if (error) throw new Error(error.message);
    if (typeof data !== 'string' || !data) {
      throw new Error('Employee write did not return an id');
    }
    return data;
  }
}
