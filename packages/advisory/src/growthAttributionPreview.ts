import { authorize, type AuthorizationContext, type TenantScope } from '../../core/src';

/** Projection of existing network_attributions; deliberately excludes evidence_json. */
export type NetworkAttributionProjection = {
  id: string; org_id: string; customer_id: string; campaign_id: string | null;
  policy_version: string; status: string; first_touch_at: string; converted_at: string | null;
};
const statuses = new Set(['pending', 'qualified', 'converted', 'rejected', 'reversed']);
const present = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const scoped = (scope: TenantScope) => present(scope?.tenantId) && present(scope?.organizationId);
function timestamp(value: string | null): number {
  if (typeof value !== 'string') return NaN;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return NaN;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59) return NaN;
  return Date.parse(value);
}

/**
 * Internal, read-only preview, NOT a session verifier or a live reporting endpoint.
 * Callers must derive actor/scope and fetch rows in trusted server context under RLS.
 * network_attributions has no tenant/firm column: never infer a firm grant from it.
 * Results describe only supplied rows; pagination completeness, payment, advertising
 * spend and third-party conversion attribution are deliberately not asserted.
 */
export function previewNetworkCampaignAttribution(input: {
  actor: AuthorizationContext; resourceScope: TenantScope; campaignId: string;
  from: string; to: string; rows: readonly NetworkAttributionProjection[];
}) {
  if (!scoped(input.actor.scope) || !scoped(input.resourceScope) ||
      !authorize(input.actor, { scope: input.resourceScope, permission: 'analytics.read' }).ok) {
    throw new Error('attribution_access_denied');
  }
  if (!present(input.campaignId)) throw new Error('attribution_campaign_required');
  const from = timestamp(input.from), to = timestamp(input.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) throw new Error('attribution_window_invalid');
  const rowIds = new Map<string, string>();
  const owners = new Set<string>();
  let converted = 0;
  for (const row of input.rows) {
    if (row.org_id !== input.resourceScope.organizationId || row.campaign_id !== input.campaignId) {
      throw new Error('attribution_source_scope_mismatch');
    }
    const touched = timestamp(row.first_touch_at), conversion = timestamp(row.converted_at);
    if (!present(row.id) || !present(row.customer_id) || !present(row.policy_version) ||
        !statuses.has(row.status) || !Number.isFinite(touched) ||
        (row.converted_at !== null && (!Number.isFinite(conversion) || conversion < touched)) ||
        (row.status === 'converted' && !Number.isFinite(conversion))) {
      throw new Error('attribution_source_invalid');
    }
    const fingerprint = JSON.stringify([row.org_id, row.customer_id, row.campaign_id, row.policy_version, row.status, touched, Number.isFinite(conversion) ? conversion : null]);
    const previous = rowIds.get(row.id);
    if (previous !== undefined) {
      if (previous !== fingerprint) throw new Error('attribution_duplicate_conflict');
      continue;
    }
    rowIds.set(row.id, fingerprint);
    // Matches the original unique index for qualified/converted ownership.
    if (row.status === 'qualified' || row.status === 'converted') {
      if (owners.has(row.customer_id)) throw new Error('attribution_customer_conflict');
      owners.add(row.customer_id);
    }
    if (row.status === 'converted' && conversion >= from && conversion < to) converted += 1;
  }
  return {
    convertedReferralsInProvidedRows: converted,
    paidCustomers: null, spendCents: null, attributedRevenueCents: null,
    reportingReady: false as const
  };
}
