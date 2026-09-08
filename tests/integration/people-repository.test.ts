import { describe, expect, it } from 'vitest';
import {
  PeopleRepositoryImpl,
  type PeopleReadGateway,
  type PeopleTable,
} from '../../packages/people/src';

class FixtureGateway implements PeopleReadGateway {
  readonly calls: Array<{ table: PeopleTable; organizationId: string }> = [];

  constructor(private readonly rows: Partial<Record<PeopleTable, unknown[]>>) {}

  async select<T>(table: PeopleTable, _columns: string, organizationId: string): Promise<T[]> {
    this.calls.push({ table, organizationId });
    return (this.rows[table] ?? []) as T[];
  }
}

describe('ATLAS People repository', () => {
  it('requires organization scope and never returns employees from another organization', async () => {
    const gateway = new FixtureGateway({
      employees: [
        {
          id: 'employee-a',
          org_id: 'org-a',
          user_id: 'user-a',
          full_name: 'Ada Rivera',
          department: 'Finance',
          job_title: 'Payroll Specialist',
          status: 'active',
          created_at: '2026-09-06T08:00:00Z',
          updated_at: '2026-09-06T08:00:00Z',
        },
        {
          id: 'employee-b',
          org_id: 'org-b',
          user_id: 'user-b',
          full_name: 'Other Organization',
          department: 'Operations',
          job_title: 'Manager',
          status: 'active',
          created_at: '2026-09-06T08:00:00Z',
          updated_at: '2026-09-06T08:00:00Z',
        },
      ],
    });
    const repository = new PeopleRepositoryImpl(gateway);

    const employees = await repository.listEmployees('org-a');

    expect(employees).toHaveLength(1);
    expect(employees[0]).toMatchObject({
      id: 'employee-a',
      organizationId: 'org-a',
      fullName: 'Ada Rivera',
    });
    expect(gateway.calls).toEqual([{ table: 'employees', organizationId: 'org-a' }]);
  });

  it('returns null when an employee id resolves only outside the requested organization', async () => {
    const gateway = new FixtureGateway({
      employees: [
        {
          id: 'employee-other-org',
          org_id: 'org-b',
          user_id: null,
          full_name: 'Other Organization',
          department: null,
          job_title: null,
          status: 'active',
          created_at: '2026-09-06T08:00:00Z',
          updated_at: '2026-09-06T08:00:00Z',
        },
      ],
    });
    const repository = new PeopleRepositoryImpl(gateway);

    expect(await repository.getEmployee('org-a', 'employee-other-org')).toBeNull();
  });

  it('rejects an empty organization id before querying a gateway', async () => {
    const gateway = new FixtureGateway({ employees: [] });
    const repository = new PeopleRepositoryImpl(gateway);

    await expect(repository.listEmployees('   ')).rejects.toThrow('organizationId is required');
    expect(gateway.calls).toEqual([]);
  });
});
