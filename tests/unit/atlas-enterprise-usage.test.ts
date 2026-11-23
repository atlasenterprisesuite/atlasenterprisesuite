import { describe, expect, it, vi } from 'vitest';
import { readEnterpriseUsage, EnterpriseUsageError } from '../../supabase/functions/atlas-execution/enterprise-usage';

function context() {
  return { orgId: 'org-a', userId: 'user-a', role: 'owner', permissions: ['execution.read'] };
}

function mockDatabase(result: { data: unknown; error: unknown; count: number | null }) {
  const filters: Array<[string, string, string]> = [];
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: string) => { filters.push(['eq', column, value]); return query; }),
    gte: vi.fn((column: string, value: string) => { filters.push(['gte', column, value]); return query; }),
    lt: vi.fn((column: string, value: string) => { filters.push(['lt', column, value]); return query; }),
    order: vi.fn(() => query),
    limit: vi.fn(async () => result)
  };
  return { admin: { from: vi.fn(() => query) }, query, filters };
}

const rows = [
  { id: 'event-2', created_at: '2026-11-20T12:00:00Z', task_class: 'planning', status: 'completed', input_tokens: 10, output_tokens: 20, estimated_cost_usd: '0.000000' },
  { id: 'event-1', created_at: '2026-11-03T12:00:00Z', task_class: 'assistant', status: 'completed', input_tokens: 12, output_tokens: 22, estimated_cost_usd: '0.001200' }
];

describe('ATLAS Enterprise Usage — authenticated read-only server adapter', () => {
  it('queries canonical usage using only the verified actor and org scope', async () => {
    const db = mockDatabase({ data: rows, error: null, count: 3 });
    const result = await readEnterpriseUsage({ admin: db.admin, context: context(), now: new Date('2026-11-23T18:00:00Z') });
    expect(db.admin.from).toHaveBeenCalledWith('atlas_ai_usage');
    expect(db.query.select).toHaveBeenCalledWith(
      'id,created_at,task_class,status,input_tokens,output_tokens,estimated_cost_usd',
      { count: 'exact' }
    );
    expect(db.filters).toEqual([
      ['eq', 'org_id', 'org-a'],
      ['eq', 'actor_id', 'user-a'],
      ['gte', 'created_at', '2026-11-01T00:00:00.000Z'],
      ['lt', 'created_at', '2026-12-01T00:00:00.000Z']
    ]);
    expect(db.query.limit).toHaveBeenCalledWith(20);
    expect(result).toMatchObject({
      source: 'atlas_ai_usage',
      period: '2026-11',
      eventCount: 3,
      sampleIsComplete: false,
      creditLimitStatus: 'unconfigured',
      creditsRemaining: null,
      paidExecutionEnabled: false
    });
    expect(result.recentEvents).toHaveLength(2);
  });

  it('reports a verified empty period without inventing usage or credits', async () => {
    const db = mockDatabase({ data: [], error: null, count: 0 });
    const result = await readEnterpriseUsage({ admin: db.admin, context: context(), now: new Date('2026-11-23T18:00:00Z') });
    expect(result.eventCount).toBe(0);
    expect(result.sampleIsComplete).toBe(true);
    expect(result.recentEvents).toEqual([]);
    expect(result.creditsRemaining).toBeNull();
  });

  it('fails closed on database errors and missing exact count', async () => {
    for (const value of [{ data: [], error: { message: 'db unavailable' }, count: 0 }, { data: [], error: null, count: null }]) {
      const db = mockDatabase(value);
      await expect(readEnterpriseUsage({ admin: db.admin, context: context(), now: new Date('2026-11-23') }))
        .rejects.toMatchObject({ code: 'usage_unavailable' });
    }
  });

  it('rejects missing authenticated context and malformed database data', async () => {
    const db = mockDatabase({ data: rows, error: null, count: 2 });
    await expect(readEnterpriseUsage({ admin: db.admin, context: { ...context(), userId: '' }, now: new Date('2026-11-23') }))
      .rejects.toMatchObject({ code: 'authoritative_context_required' });
    expect(db.admin.from).not.toHaveBeenCalled();
    const bad = mockDatabase({ data: [{ ...rows[0], input_tokens: -1 }], error: null, count: 1 });
    await expect(readEnterpriseUsage({ admin: bad.admin, context: context(), now: new Date('2026-11-23') }))
      .rejects.toMatchObject({ code: 'usage_data_invalid' });
  });

  it('restricts reads to authorized execution.read actors', async () => {
    const db = mockDatabase({ data: rows, error: null, count: 2 });
    await expect(readEnterpriseUsage({ admin: db.admin, context: { ...context(), permissions: [] }, now: new Date('2026-11-23') }))
      .rejects.toMatchObject({ code: 'permission_required' });
    expect(db.admin.from).not.toHaveBeenCalled();
  });

  it('never mutates quota, usage, memberships or audit data', async () => {
    const db = mockDatabase({ data: rows, error: null, count: 2 });
    await readEnterpriseUsage({ admin: db.admin, context: context(), now: new Date('2026-11-23') });
    expect(db.admin.from).toHaveBeenCalledTimes(1);
    expect(db.query).not.toHaveProperty('insert');
    expect(db.query).not.toHaveProperty('update');
    expect(db.query).not.toHaveProperty('delete');
  });
});
