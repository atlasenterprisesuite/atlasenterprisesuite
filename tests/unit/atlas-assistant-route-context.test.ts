import { describe, expect, it } from 'vitest';
import { resolveAssistantModule } from '../../apps/web/src/assistant/routeContext';

describe('ATLAS Assistant route context', () => {
  it.each([
    ['/finance/accounting/accounts-payable', 'finance.accounting.accounts-payable'],
    ['/finance/accounting/accounts-receivable', 'finance.accounting.accounts-receivable'],
    ['/business/network', 'business.network'],
    ['/business', 'business'],
    ['/revenue', 'revenue'],
    ['/analytics', 'analytics'],
    ['/commerce/orders', 'commerce'],
    ['/crm/accounts', 'crm'],
    ['/payroll', 'payroll'],
    ['/learning/course/123', 'learning'],
    ['/hospitality/hotels', 'hospitality'],
    ['/frontier', 'frontier'],
    ['/ride/trips', 'ride'],
    ['/voice/assistant', 'voice'],
    ['/studio/voice', 'studio.voice'],
    ['/execution/manager/readiness', 'execution.manager']
  ])('maps %s to %s', (pathname, expected) => {
    expect(resolveAssistantModule(pathname)).toBe(expected);
  });

  it('uses atlas.home for unknown routes', () => {
    expect(resolveAssistantModule('/something-new')).toBe('atlas.home');
  });
});
