import { describe, expect, it } from 'vitest';
import { resolveAssistantModule } from '../../apps/web/src/assistant/routeContext';

describe('ATLAS Assistant route context', () => {
  it.each([
    ['/finance/accounting/accounts-payable', 'finance.accounting.accounts-payable'],
    ['/business', 'business'],
    ['/crm/accounts', 'crm'],
    ['/payroll', 'payroll'],
    ['/learning/course/123', 'learning'],
    ['/hospitality/hotels', 'hospitality'],
    ['/ride/trips', 'ride'],
    ['/studio/voice', 'studio.voice'],
    ['/execution/manager/readiness', 'execution.manager']
  ])('maps %s to %s', (pathname, expected) => {
    expect(resolveAssistantModule(pathname)).toBe(expected);
  });

  it('uses atlas.home for unknown routes', () => {
    expect(resolveAssistantModule('/something-new')).toBe('atlas.home');
  });
});
