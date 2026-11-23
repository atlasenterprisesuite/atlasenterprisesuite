/**
 * ATLAS Enterprise usage transparency — read-only, actor-scoped projection.
 *
 * This adapter is called ONLY after the canonical atlas-execution Edge handler
 * verifies the JWT, active organization membership, and execution.read rights.
 * All protected filters are derived from that trusted context (never the body).
 *
 * atlas_ai_usage records historical AI consumption, NOT transferable credits
 * and NOT an atomic quota ledger. Do not use this report to authorize spending.
 */
export class EnterpriseUsageError extends Error {
  constructor(readonly code: string, readonly status = 503) {
    super(code);
  }
}

export type EnterpriseUsageContext = {
  orgId: string;
  userId: string;
  permissions: readonly string[];
};

export type EnterpriseUsageEvent = {
  id: string;
  createdAt: string;
  taskClass: string | null;
  status: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: string | null;
};

export type EnterpriseUsageReport = {
  source: 'atlas_ai_usage';
  period: string;
  eventCount: number;
  sampleIsComplete: boolean;
  recentEvents: EnterpriseUsageEvent[];
  creditLimitStatus: 'unconfigured';
  creditsRemaining: null;
  paidExecutionEnabled: false;
};

type ServerDeps = {
  // Only trusted server dependencies may be injected. This is deliberately
  // compatible with the existing server-only Supabase admin adapter.
  admin: any;
  context: EnterpriseUsageContext;
  now?: Date;
};

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nullableText(value: unknown, max = 120): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new EnterpriseUsageError('usage_data_invalid', 500);
  return value.slice(0, max);
}

function nullableTokens(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new EnterpriseUsageError('usage_data_invalid', 500);
  }
  return value;
}

function nullableDecimal(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const stringValue = String(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(stringValue)) {
    throw new EnterpriseUsageError('usage_data_invalid', 500);
  }
  return stringValue;
}

export async function readEnterpriseUsage({ admin, context, now = new Date() }: ServerDeps): Promise<EnterpriseUsageReport> {
  if (!nonEmpty(context?.orgId) || !nonEmpty(context?.userId) || !Array.isArray(context?.permissions)) {
    throw new EnterpriseUsageError('authoritative_context_required', 403);
  }
  if (!context.permissions.includes('execution.read') && !context.permissions.includes('execution.admin')) {
    throw new EnterpriseUsageError('permission_required', 403);
  }
  if (!(now instanceof Date) || !Number.isFinite(now.valueOf())) {
    throw new EnterpriseUsageError('invalid_usage_window', 500);
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  let result: { data?: unknown; error?: unknown; count?: number | null };
  try {
    result = await admin.from('atlas_ai_usage')
      .select('id,created_at,task_class,status,input_tokens,output_tokens,estimated_cost_usd', { count: 'exact' })
      .eq('org_id', context.orgId)
      .eq('actor_id', context.userId)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);
  } catch {
    throw new EnterpriseUsageError('usage_unavailable');
  }

  if (result?.error || !Number.isSafeInteger(result?.count) || (result.count ?? -1) < 0 ||
      !Array.isArray(result?.data) || result.data.length > (result.count ?? -1) ||
      result.data.length > 20) {
    throw new EnterpriseUsageError('usage_unavailable');
  }

  const recentEvents = result.data.map((value): EnterpriseUsageEvent => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new EnterpriseUsageError('usage_data_invalid', 500);
    }
    const row = value as Record<string, unknown>;
    if (!nonEmpty(row.id) || !nonEmpty(row.created_at) ||
        !Number.isFinite(Date.parse(row.created_at))) {
      throw new EnterpriseUsageError('usage_data_invalid', 500);
    }
    return {
      id: row.id,
      createdAt: row.created_at,
      taskClass: nullableText(row.task_class),
      status: nullableText(row.status),
      inputTokens: nullableTokens(row.input_tokens),
      outputTokens: nullableTokens(row.output_tokens),
      estimatedCostUsd: nullableDecimal(row.estimated_cost_usd)
    };
  });

  return {
    source: 'atlas_ai_usage',
    period: start.toISOString().slice(0, 7),
    eventCount: result.count!,
    sampleIsComplete: result.count === recentEvents.length,
    recentEvents,
    creditLimitStatus: 'unconfigured',
    creditsRemaining: null,
    paidExecutionEnabled: false
  };
}
