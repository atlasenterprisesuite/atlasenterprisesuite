import { describe, expect, it } from 'vitest';
import { loadEnabledAtlasModuleCodes } from '../../apps/web/src/lib/supabase/moduleStateRepository';

describe('ATLAS organization module state repository', () => {
  it('reads only the authenticated tenant and organization scope and returns enabled module codes', async () => {
    const filters: unknown[] = [];
    const query = {
      select: () => query,
      eq: (column: string, value: string) => {
        filters.push([column, value]);
        return query;
      },
      then: (resolve: (value: unknown) => void) => resolve({
        data: [
          { module_code: 'accounting', enabled: true },
          { module_code: 'health', enabled: false },
          { module_code: 'people', enabled: true },
        ],
        error: null,
      }),
    };
    const client = { from: (table: string) => {
      expect(table).toBe('organization_modules');
      return query;
    } };

    const result = await loadEnabledAtlasModuleCodes(client as never, 'tenant-1', 'org-1');

    expect(filters).toEqual([['tenant_id', 'tenant-1'], ['org_id', 'org-1']]);
    expect([...result].sort()).toEqual(['accounting', 'people']);
  });

  it('fails closed on repository errors', async () => {
    const query = {
      select: () => query,
      eq: () => query,
      then: (resolve: (value: unknown) => void) => resolve({ data: null, error: { message: 'denied' } }),
    };
    const client = { from: () => query };

    await expect(loadEnabledAtlasModuleCodes(client as never, 'tenant-1', 'org-1')).rejects.toThrow('module_state_unavailable');
  });
});
