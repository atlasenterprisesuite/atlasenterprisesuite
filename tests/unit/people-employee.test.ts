import { describe, expect, it } from 'vitest';
import { validateEmployeeMutation } from '../../packages/people/src';

describe('ATLAS People employee contracts', () => {
  it('accepts a valid organization-scoped employee mutation', () => {
    const result = validateEmployeeMutation({
      scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
      fullName: 'Ada Rivera',
      department: 'Finance',
      jobTitle: 'Payroll Specialist',
      status: 'active',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fullName).toBe('Ada Rivera');
      expect(result.value.scope).toEqual({ tenantId: 'tenant-a', organizationId: 'org-a' });
    }
  });

  it('normalizes employee names without changing the requested scope', () => {
    const result = validateEmployeeMutation({
      scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
      fullName: '  Ada Rivera  ',
      department: null,
      jobTitle: null,
      status: 'leave',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
        fullName: 'Ada Rivera',
        department: null,
        jobTitle: null,
        status: 'leave',
      },
    });
  });

  it('rejects an empty employee name', () => {
    const result = validateEmployeeMutation({
      scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
      fullName: '   ',
      department: null,
      jobTitle: null,
      status: 'active',
    });

    expect(result).toEqual({ ok: false, error: 'Employee full name is required.' });
  });
});
