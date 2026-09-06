import { describe, expect, it } from 'vitest';
import {
  CompensationRepositoryImpl,
  type CompensationReadGateway,
} from '../../packages/people/src';

const rows: Record<string, unknown[]> = {
  people_compensation: [
    { id: 'comp-a', org_id: 'org-a', employee_id: 'employee-a', pay_type: 'hourly', hourly_rate: 22, annual_salary: null, effective_from: '2026-07-01', effective_to: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
    { id: 'comp-b', org_id: 'org-b', employee_id: 'employee-b', pay_type: 'salary', hourly_rate: null, annual_salary: 80000, effective_from: '2026-01-01', effective_to: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  ],
  people_deductions: [
    { id: 'ded-a', org_id: 'org-a', employee_id: 'employee-a', code: 'HEALTH', label: 'Health Plan', treatment: 'pretax', calculation_type: 'fixed', amount: 50, active: true, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  ],
};

class FixtureGateway implements CompensationReadGateway {
  async select<T>(table: keyof typeof rows, _columns: string, _organizationId: string): Promise<T[]> {
    return (rows[table] ?? []) as T[];
  }
}

describe('ATLAS Compensation repository', () => {
  it('defensively filters compensation and deductions by organization', async () => {
    const repository = new CompensationRepositoryImpl(new FixtureGateway());
    expect((await repository.listCompensation('org-a')).map((item) => item.id)).toEqual(['comp-a']);
    expect((await repository.listDeductions('org-a')).map((item) => item.id)).toEqual(['ded-a']);
  });

  it('can scope results to one employee', async () => {
    const repository = new CompensationRepositoryImpl(new FixtureGateway());
    expect(await repository.listCompensation('org-a', 'employee-missing')).toEqual([]);
    expect((await repository.listDeductions('org-a', 'employee-a')).map((item) => item.code)).toEqual(['HEALTH']);
  });
});
