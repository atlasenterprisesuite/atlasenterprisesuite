/**
 * Server-trusted, read-only Enterprise credit allocation projection.
 * An allocation does not authorize spending or provider calls.
 *
 * MUST only be called after atlas-execution resolves a real Supabase session
 * and current active organization membership. No context fields from user body.
 */
export class EnterpriseCreditReadError extends Error {
  constructor(readonly code: string, readonly status = 503) { super(code); }
}

type TrustedContext = {
  orgId: string;
  userId: string;
  permissions: readonly string[];
};

export type EnterpriseCreditStatus = {
  source: 'atlas_enterprise_credit_accounts';
  status: 'not_installed' | 'unconfigured' | 'disabled' | 'allocated';
  period: string;
  limitCredits: number | null;
  reservedCredits: number | null;
  spentCredits: number | null;
  availableCredits: number | null;
  /** Never imply a provider was authorized from an internal ledger balance. */
  paidExecutionEnabled: false;
};

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function safeCredits(value: unknown): number {
  if (typeof value === 'string' && !/^(0|[1-9]\d*)$/.test(value)) {
    throw new EnterpriseCreditReadError('enterprise_credit_data_invalid', 500);
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new EnterpriseCreditReadError('enterprise_credit_data_invalid', 500);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new EnterpriseCreditReadError('enterprise_credit_data_invalid', 500);
  }
  return number;
}

export async function readEnterpriseCreditStatus({
  admin, context, now = new Date()
}: { admin: any; context: TrustedContext; now?: Date }): Promise<EnterpriseCreditStatus> {
  if (!nonEmpty(context?.orgId) || !nonEmpty(context?.userId) ||
      !Array.isArray(context?.permissions)) {
    throw new EnterpriseCreditReadError('authoritative_context_required', 403);
  }
  if (!context.permissions.includes('execution.read') &&
      !context.permissions.includes('execution.admin')) {
    throw new EnterpriseCreditReadError('permission_required', 403);
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new EnterpriseCreditReadError('invalid_usage_window', 500);
  }
  const period = now.toISOString().slice(0, 7);
  const disabled = (status: EnterpriseCreditStatus['status']): EnterpriseCreditStatus => ({
    source: 'atlas_enterprise_credit_accounts',
    status, period, limitCredits: null, reservedCredits: null,
    spentCredits: null, availableCredits: null, paidExecutionEnabled: false
  });

  let result: { data?: unknown; error?: { code?: string } | null };
  try {
    result = await admin.from('atlas_enterprise_credit_accounts')
      .select('window_id,limit_credits,reserved_credits,spent_credits,enabled')
      .eq('org_id', context.orgId)
      .eq('user_id', context.userId)
      .eq('window_id', period)
      .maybeSingle();
  } catch {
    throw new EnterpriseCreditReadError('enterprise_credit_read_unavailable');
  }
  if (result?.error) {
    // Explicitly different from "no allocation"; versioned migration may be
    // absent, or the Data API might not expose this new table.
    if (['42P01', 'PGRST205'].includes(String(result.error.code))) {
      return disabled('not_installed');
    }
    throw new EnterpriseCreditReadError('enterprise_credit_read_unavailable');
  }
  if (!result || result.data === null) return disabled('unconfigured');
  if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
    throw new EnterpriseCreditReadError('enterprise_credit_data_invalid', 500);
  }
  const row = result.data as Record<string, unknown>;
  if (row.window_id !== period || typeof row.enabled !== 'boolean') {
    throw new EnterpriseCreditReadError('enterprise_credit_data_invalid', 500);
  }

  const limit = safeCredits(row.limit_credits);
  const reserved = safeCredits(row.reserved_credits);
  const spent = safeCredits(row.spent_credits);
  if (reserved > limit || spent > limit - reserved) {
    throw new EnterpriseCreditReadError('enterprise_credit_data_invalid', 500);
  }

  return {
    source: 'atlas_enterprise_credit_accounts',
    status: row.enabled ? 'allocated' : 'disabled',
    period, limitCredits: limit,
    reservedCredits: reserved,
    spentCredits: spent,
    availableCredits: limit - reserved - spent,
    paidExecutionEnabled: false
  };
}
