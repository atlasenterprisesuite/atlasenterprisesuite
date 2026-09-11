import { describe, expect, it } from 'vitest';
import { resolveAssistantModule } from '../../apps/web/src/assistant/routeContext';

describe('resolveAssistantModule', () => {
  it('maps accounts payable to the accounting AP module', () => {
    expect(resolveAssistantModule('/finance/accounting/accounts-payable')).toBe('finance.accounting.accounts-payable');
  });

  it('maps voice studio to the voice module', () => {
    expect(resolveAssistantModule('/studio/voice')).toBe('studio.voice');
  });

  it('keeps health research context distinct from health home', () => {
    expect(resolveAssistantModule('/health/research/frontiers')).toBe('health.research.frontiers');
  });

  it('falls back to enterprise home', () => {
    expect(resolveAssistantModule('/')).toBe('atlas.home');
  });
});
