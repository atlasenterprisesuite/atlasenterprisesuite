import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { summarizeAIActivity } from '../../supabase/functions/atlas-copilot/usage-insights.mjs';

const periodStart = '2026-10-10T12:00:00.000Z';
const periodEnd = '2026-10-12T12:00:00.000Z';
const observed = [
  { actor_id: 'person-a', status: 'completed', created_at: '2026-10-10T15:00:00Z' },
  { actor_id: 'person-a', status: 'failed', created_at: '2026-10-11T12:01:00Z' },
  { actor_id: 'person-b', status: 'completed', created_at: '2026-10-11T20:00:00Z' },
  { actor_id: 'person-b', status: 'started', created_at: '2026-10-12T10:00:00Z' },
];

describe('ATLAS Enterprise AI Insights', () => {
  it('counts request activity and distinct actors from observed rows, not illustrative values', () => {
    const summary = summarizeAIActivity(observed, { periodStart, periodEnd, sourceLimit: 100 });
    expect(summary).toMatchObject({
      active_users: 2,
      identity_coverage: 'complete',
      source_coverage: 'complete',
      observed_requests: 4,
    });
    expect(summary.daily_activity).toEqual([
      { date: '2026-10-10', requests: 1, completed: 1, failed: 0, active_users: 1 },
      { date: '2026-10-11', requests: 2, completed: 1, failed: 1, active_users: 2 },
      { date: '2026-10-12', requests: 1, completed: 0, failed: 0, active_users: 1 },
    ]);
    expect(JSON.stringify(summary)).not.toContain('person-a');
    expect(JSON.stringify(summary)).not.toContain('person-b');
  });

  it('does not count out-of-window rows, invent percentage increases, or invent business ROI', () => {
    const summary = summarizeAIActivity([
      ...observed,
      { actor_id: 'unrelated', status: 'completed', created_at: '2026-10-09T12:00:00Z' },
      { actor_id: 'unrelated', status: 'completed', created_at: '2026-10-13T12:00:00Z' },
    ], { periodStart, periodEnd, sourceLimit: 100 });
    expect(summary.observed_requests).toBe(4);
    expect(summary.active_users).toBe(2);
    expect(summary).not.toHaveProperty('business_roi_percent');
    expect(summary).not.toHaveProperty('growth_percent');
    expect(summary).not.toHaveProperty('team_usage');
  });

  it('fails closed on missing actor IDs and marks the sampling limit as potentially incomplete', () => {
    const summary = summarizeAIActivity([
      observed[0],
      { status: 'completed', created_at: '2026-10-11T14:00:00Z' },
    ], { periodStart, periodEnd, sourceLimit: 2 });
    expect(summary.identity_coverage).toBe('partial');
    expect(summary.active_users).toBeNull();
    expect(summary.daily_activity[0].active_users).toBe(1);
    expect(summary.daily_activity[1].active_users).toBeNull();
    expect(summary.source_coverage).toBe('potentially_truncated');
  });

  it('validates the reporting window instead of displaying invalid charts', () => {
    expect(() => summarizeAIActivity(observed, { periodStart: periodEnd, periodEnd: periodStart })).toThrow();
    expect(() => summarizeAIActivity(observed, { periodStart: 'invalid', periodEnd })).toThrow();
  });

  it('extends existing permission-scoped telemetry without publishing actor details', () => {
    const store = readFileSync('supabase/functions/atlas-copilot/atlas-intelligence-store.mjs', 'utf8');
    const page = readFileSync('apps/web/src/modules/creator/AIUniversePage.tsx', 'utf8');
    const insights = readFileSync('apps/web/src/modules/intelligence/EnterpriseUsageInsights.tsx', 'utf8');
    const assistant = readFileSync('apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx', 'utf8');

    expect(store).toContain('actorFilter=canManage(c)');
    expect(store).toContain('org_id=eq.${enc(c.organization_id)}');
    expect(store).toContain('summarizeAIActivity(source,');
    expect(store).toContain('actor_id');
    expect(page).toContain('EnterpriseUsageInsights');
    expect(insights).toContain('No verified team mapping');
    expect(insights).toContain('No verified business outcome attribution');
    expect(insights).toContain('source_coverage');
    expect(insights).not.toContain('14.5%');
    expect(insights).not.toMatch(/OPENAI_API_KEY|GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY/);
    expect(assistant).toContain("to: '/studio/ai-universe#enterprise-ai-insights'");
  });
});
