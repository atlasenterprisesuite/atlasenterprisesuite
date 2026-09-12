import { describe, expect, test } from 'vitest';
import { mapForecastSnapshot } from '../../packages/accounting/src';

describe('Accounting forecast snapshot mapping', () => {
  test('maps the canonical Supabase row without fabricating values', () => {
    expect(mapForecastSnapshot({
      id: 'forecast-1',
      org_id: 'org-1',
      entity_id: null,
      as_of_date: '2026-09-12',
      horizon_weeks: 13,
      scenario: 'base',
      forecast: { currency: 'USD', ending_cash: 125000 },
      assumptions: { collections_days: 32 },
      created_by: 'user-1',
      created_at: '2026-09-12T06:00:00Z',
    })).toEqual({
      id: 'forecast-1',
      organizationId: 'org-1',
      entityId: null,
      asOfDate: '2026-09-12',
      horizonWeeks: 13,
      scenario: 'base',
      forecast: { currency: 'USD', ending_cash: 125000 },
      assumptions: { collections_days: 32 },
      createdBy: 'user-1',
      createdAt: '2026-09-12T06:00:00Z',
    });
  });
});
