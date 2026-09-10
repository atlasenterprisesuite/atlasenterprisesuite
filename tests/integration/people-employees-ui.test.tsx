// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';

describe('ATLAS People employee administration UI', () => {
  it('exposes the employee administration page and governed write provider', async () => {
    let pageModule: Record<string, unknown> = {};
    let providerModule: Record<string, unknown> = {};

    try {
      pageModule = await import('../../apps/web/src/modules/people/EmployeesPage');
      providerModule = await import('../../apps/web/src/modules/people/PeopleEmployeeWriteProvider');
    } catch {
      pageModule = {};
      providerModule = {};
    }

    expect(typeof pageModule.EmployeesPage).toBe('function');
    expect(typeof providerModule.PeopleEmployeeWriteProvider).toBe('function');
    expect(typeof providerModule.usePeopleEmployeeWriteService).toBe('function');
  });
});
