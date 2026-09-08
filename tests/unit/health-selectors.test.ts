import { describe, expect, it } from 'vitest';
import { filterHealthRecords } from '../../packages/health/src';

const records = [
  { id: '1', tenantId: 't1', organizationId: 'o1', moduleId: 'smart-facilities' as const, title: 'MRI cooling inspection', status: 'open', category: 'maintenance', sourceState: 'demo' as const },
  { id: '2', tenantId: 't1', organizationId: 'o1', moduleId: 'smart-facilities' as const, title: 'Elevator inspection', status: 'closed', category: 'inspection', sourceState: 'demo' as const }
];

describe('Health selectors', () => {
  it('filters by query and status', () => {
    expect(filterHealthRecords(records, 'MRI', 'open')).toHaveLength(1);
    expect(filterHealthRecords(records, 'MRI', 'closed')).toHaveLength(0);
  });
});
