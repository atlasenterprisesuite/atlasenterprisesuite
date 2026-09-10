import { describe, expect, it, vi } from 'vitest';

describe('ATLAS People employee write service', () => {
  it('exposes the governed employee write service boundary', async () => {
    let module: Record<string, unknown> = {};
    try {
      module = await import('../../packages/people/src/employeeWrites');
    } catch {
      module = {};
    }

    expect(typeof module.PeopleEmployeeWriteService).toBe('function');
  });

  it('normalizes a new employee before calling the governed gateway', async () => {
    const { PeopleEmployeeWriteService } = await import('../../packages/people/src/employeeWrites');
    const gateway = {
      createEmployee: vi.fn().mockResolvedValue('employee-1'),
      updateEmployee: vi.fn().mockResolvedValue('employee-1'),
    };
    const service = new PeopleEmployeeWriteService(gateway);

    await expect(service.createEmployee({
      scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
      fullName: '  Ada Rivera  ',
      department: '  Finance  ',
      jobTitle: '  Payroll Specialist  ',
      status: 'active',
    })).resolves.toBe('employee-1');

    expect(gateway.createEmployee).toHaveBeenCalledWith({
      scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
      fullName: 'Ada Rivera',
      department: 'Finance',
      jobTitle: 'Payroll Specialist',
      status: 'active',
    });
  });

  it('requires an employee id when updating', async () => {
    const { PeopleEmployeeWriteService } = await import('../../packages/people/src/employeeWrites');
    const gateway = {
      createEmployee: vi.fn().mockResolvedValue('employee-1'),
      updateEmployee: vi.fn().mockResolvedValue('employee-1'),
    };
    const service = new PeopleEmployeeWriteService(gateway);

    await expect(service.updateEmployee({
      employeeId: '   ',
      scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
      fullName: 'Ada Rivera',
      department: null,
      jobTitle: null,
      status: 'active',
    })).rejects.toThrow('Employee is required.');

    expect(gateway.updateEmployee).not.toHaveBeenCalled();
  });
});
