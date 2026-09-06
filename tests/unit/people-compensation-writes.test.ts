import { describe, expect, it, vi } from 'vitest';
import {
  PeopleCompensationWriteService,
  type PeopleCompensationWriteGateway,
} from '../../packages/people/src';

describe('ATLAS Compensation write service', () => {
  it('validates and forwards hourly compensation', async () => {
    const createCompensation = vi.fn(async () => 'comp-a');
    const gateway: PeopleCompensationWriteGateway = {
      createCompensation,
      setDeduction: async () => 'ded-a',
    };
    const service = new PeopleCompensationWriteService(gateway);

    await service.createCompensation({
      organizationId: 'org-a', employeeId: 'employee-a', payType: 'hourly', hourlyRate: 22,
      annualSalary: null, effectiveFrom: '2026-07-01', effectiveTo: null,
    });

    expect(createCompensation).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-a', employeeId: 'employee-a', payType: 'hourly', hourlyRate: 22,
    }));
  });

  it('rejects mixed hourly and salary compensation', async () => {
    const gateway: PeopleCompensationWriteGateway = {
      createCompensation: async () => 'comp-a',
      setDeduction: async () => 'ded-a',
    };
    const service = new PeopleCompensationWriteService(gateway);

    await expect(service.createCompensation({
      organizationId: 'org-a', employeeId: 'employee-a', payType: 'hourly', hourlyRate: 22,
      annualSalary: 80000, effectiveFrom: '2026-07-01', effectiveTo: null,
    })).rejects.toThrow(/hourly/i);
  });

  it('validates deduction semantics before persistence', async () => {
    const setDeduction = vi.fn(async () => 'ded-a');
    const gateway: PeopleCompensationWriteGateway = {
      createCompensation: async () => 'comp-a',
      setDeduction,
    };
    const service = new PeopleCompensationWriteService(gateway);

    await service.setDeduction({
      organizationId: 'org-a', employeeId: 'employee-a', code: 'HEALTH', label: 'Health Plan',
      treatment: 'pretax', calculationType: 'percent', amount: 0.05, active: true,
    });

    expect(setDeduction).toHaveBeenCalledWith(expect.objectContaining({ code: 'HEALTH', amount: 0.05 }));

    await expect(service.setDeduction({
      organizationId: 'org-a', employeeId: 'employee-a', code: 'BAD', label: 'Bad',
      treatment: 'posttax', calculationType: 'percent', amount: 2, active: true,
    })).rejects.toThrow(/percent/i);
  });
});
