import { describe, expect, it } from 'vitest';
import { filterHealthRecords, recordsForModule } from '../../packages/health/src';
import { healthOperations } from '../../data/demo/health';

describe('Health selectors', () => {
  it('filters by module, shared ATLAS scope, search and status', () => {
    const records = recordsForModule(healthOperations, 'smart-facilities', { tenantId: 'tenant-demo', organizationId: 'org-demo' });
    expect(filterHealthRecords(records, 'MRI', 'open')).toHaveLength(1);
    expect(filterHealthRecords(records, 'MRI', 'closed')).toHaveLength(0);
  });
});
