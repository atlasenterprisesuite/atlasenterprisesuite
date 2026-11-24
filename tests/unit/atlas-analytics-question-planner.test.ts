import { describe, expect, it } from 'vitest';
import { planAnalyticsQuestion } from '../../packages/analytics/src/index';

describe('governed analytics question planner', () => {
  it('maps Spanish and English metric questions to canonical contracts', () => {
    expect(planAnalyticsQuestion('¿Cuáles son los ingresos?').metrics.map(m => m.id)).toEqual(['revenue']);
    expect(planAnalyticsQuestion('Show gross margin and revenue').metrics.map(m => m.id)).toEqual(['revenue', 'gross-margin']);
  });
  it('preserves blockers and never returns invented values or executes queries', () => {
    const plan = planAnalyticsQuestion('customer retention');
    expect(plan.status).toBe('source-gated');
    expect(plan.metrics[0].blockedSources).toContain('crm');
    expect(plan.metrics[0].value).toBeNull();
    expect(plan.executionAllowed).toBe(false);
  });
  it('does not guess an unsupported metric or accept arbitrary commands', () => {
    for (const q of ['', 'delete all records', 'product usage', 'select * from users']) {
      expect(planAnalyticsQuestion(q).status).toBe('unsupported');
      expect(planAnalyticsQuestion(q).metrics).toEqual([]);
    }
    expect(planAnalyticsQuestion('delete revenue records').status).toBe('unsupported');
    expect(planAnalyticsQuestion('nonrevenue').status).toBe('unsupported');
    expect(planAnalyticsQuestion('x'.repeat(501)).status).toBe('unsupported');
  });
});
