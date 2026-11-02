export type AdsScope = { tenantId: string; organizationId: string };
export type AdsCampaign = { id: string; scope: AdsScope; status: 'draft' | 'approved' | 'paused'; budgetMinor: number; reservedMinor: number; currency: string };
export type AdsActor = { scope: AdsScope; permissions: readonly string[] };
export type AdsReadiness = { authorized: boolean; providerVerified: boolean; state: string };
export type AdsMetric = { value: number; sourceState: 'verified' | 'demo' | 'external-gated' | 'verification-required' };
export type AdsDecision = { ok: true } | { ok: false; reason: string };
const deny = (reason: string): AdsDecision => ({ ok: false, reason });
export function adsSameScope(a: AdsScope, b: AdsScope): boolean {
  return !!a.tenantId && !!a.organizationId && a.tenantId === b.tenantId && a.organizationId === b.organizationId;
}
export function authorizeAdsDraft(actor: AdsActor, campaign: AdsCampaign): AdsDecision {
  if (!adsSameScope(actor.scope, campaign.scope)) return deny('scope_mismatch');
  return actor.permissions.includes('ads.manage') || actor.permissions.includes('ads.admin') ? { ok: true } : deny('permission_denied');
}
export function validateAdsCampaign(campaign: AdsCampaign): AdsDecision {
  if (!campaign.id.trim() || !campaign.scope.tenantId || !campaign.scope.organizationId || !/^[A-Z]{3}$/.test(campaign.currency)) return deny('invalid_campaign');
  if (!Number.isSafeInteger(campaign.budgetMinor) || campaign.budgetMinor < 0 || !Number.isSafeInteger(campaign.reservedMinor) || campaign.reservedMinor < 0 || campaign.reservedMinor > campaign.budgetMinor) return deny('invalid_budget');
  return { ok: true };
}
export function authorizeAdsActivation(actor: AdsActor, campaign: AdsCampaign, readiness: AdsReadiness, amountMinor: number): AdsDecision {
  const valid = validateAdsCampaign(campaign); if (!valid.ok) return valid;
  if (!adsSameScope(actor.scope, campaign.scope)) return deny('scope_mismatch');
  if (!actor.permissions.includes('ads.publish') && !actor.permissions.includes('ads.admin')) return deny('permission_denied');
  if (campaign.status !== 'approved') return deny('approval_required');
  if (!readiness.authorized || !readiness.providerVerified || readiness.state !== 'connected') return deny('provider_unavailable');
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > campaign.budgetMinor - campaign.reservedMinor) return deny('budget_exceeded');
  // No provider adapter exists here: activation is always blocked.
  return deny('external_activation_disabled');
}
export function verifiedAdsMetric(metric: AdsMetric): number | null {
  return metric.sourceState === 'verified' && Number.isFinite(metric.value) ? metric.value : null;
}
export function adsIdempotencyKey(scope: AdsScope, campaignId: string, requestId: string): string {
  if (!scope.tenantId || !scope.organizationId || !campaignId || !requestId) throw new Error('invalid_idempotency_key');
  return JSON.stringify([scope.tenantId, scope.organizationId, campaignId, requestId]);
}
