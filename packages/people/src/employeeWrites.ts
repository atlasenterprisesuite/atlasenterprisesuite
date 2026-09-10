import { validateEmployeeMutation } from './employee';
import type { EmployeeMutation } from './types';

export type UpdateEmployeeCommand = EmployeeMutation & {
  employeeId: string;
};

export interface PeopleEmployeeWriteGateway {
  createEmployee(command: EmployeeMutation): Promise<string>;
  updateEmployee(command: UpdateEmployeeCommand): Promise<string>;
}

function requireEmployeeMutation(command: EmployeeMutation): EmployeeMutation {
  const result = validateEmployeeMutation(command);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function requireEmployeeId(value: string): string {
  const id = value.trim();
  if (!id) throw new Error('Employee is required.');
  return id;
}

export class PeopleEmployeeWriteService {
  private readonly gateway: PeopleEmployeeWriteGateway;

  constructor(gateway: PeopleEmployeeWriteGateway) {
    this.gateway = gateway;
  }

  async createEmployee(command: EmployeeMutation): Promise<string> {
    return this.gateway.createEmployee(requireEmployeeMutation(command));
  }

  async updateEmployee(command: UpdateEmployeeCommand): Promise<string> {
    const mutation = requireEmployeeMutation(command);
    return this.gateway.updateEmployee({
      ...mutation,
      employeeId: requireEmployeeId(command.employeeId),
    });
  }
}
