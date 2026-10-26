/**
 * Pure policy gate for future Marketing Intelligence integrations.
 * No network calls, persistence or delivery operations are performed here.
 * Passing this gate does not authorize external execution by itself.
 */
export type CampaignPolicyInput = {
  organizationId: string;
  actorOrganizationId: string;
  campaignId: string;
  contentSha256: string;
  consent: { organizationId: string; granted: boolean; version: number } | null;
  approval: {
    organizationId: string;
    campaignId: string;
    contentSha256: string;
    approved: boolean;
  } | null;
  auditAvailable: boolean;
  adapterEnabled: boolean;
  idempotencyKey: string;
};

export type CampaignPolicyResult =
  | { allowed: true; reason: 'policy_passed' }
  | { allowed: false; reason: 'tenant_mismatch' | 'consent_invalid' | 'approval_invalid' | 'audit_unavailable' | 'idempotency_missing' | 'adapter_disabled' | 'invalid_request' };

export function evaluateCampaignPolicy(input: CampaignPolicyInput): CampaignPolicyResult {
  if (!input.organizationId.trim() || !input.campaignId.trim() || !input.contentSha256.trim()) {
    return { allowed: false, reason: 'invalid_request' };
  }
  if (input.organizationId !== input.actorOrganizationId) {
    return { allowed: false, reason: 'tenant_mismatch' };
  }
  if (!input.consent || input.consent.organizationId !== input.organizationId ||
      !input.consent.granted || !Number.isSafeInteger(input.consent.version) || input.consent.version < 1) {
    return { allowed: false, reason: 'consent_invalid' };
  }
  if (!input.approval || !input.approval.approved ||
      input.approval.organizationId !== input.organizationId ||
      input.approval.campaignId !== input.campaignId ||
      input.approval.contentSha256 !== input.contentSha256) {
    return { allowed: false, reason: 'approval_invalid' };
  }
  if (!input.auditAvailable) return { allowed: false, reason: 'audit_unavailable' };
  if (!input.idempotencyKey.trim()) return { allowed: false, reason: 'idempotency_missing' };
  if (!input.adapterEnabled) return { allowed: false, reason: 'adapter_disabled' };
  return { allowed: true, reason: 'policy_passed' };
}
