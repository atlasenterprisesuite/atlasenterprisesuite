/** Pure preflight contract. Never calls providers, databases or payment services. */
export type CinemaRequest = {
 organizationId: string; actorId: string; productionId: string; providerId: string;
 capabilityVerified: boolean; permissions: readonly string[]; actorOrganizationId: string;
 estimatedCostMinor: number; approvedCostMinor: number; approvalId: string | null;
 approvalOrganizationId: string | null; approvalProductionId: string | null;
 idempotencyKey: string; referenceAssetIds: readonly string[];
 referenceOrganizationIds: readonly string[]; auditReady: boolean;
 providerAcknowledgementId?: string | null;
};
export type CinemaDecision = { status: 'blocked'; reason: string } |
 { status: 'preflight-only'; idempotencyKey: string; estimatedCostMinor: number };
const forbidden = /(?:api[_-]?key|secret|bearer\s+|sk-[a-z0-9]+)/i;
export function validateCinemaPreflight(r: CinemaRequest): CinemaDecision {
 const block = (reason: string): CinemaDecision => ({ status: 'blocked', reason });
 if (!r.organizationId || !r.actorId || !r.productionId || !r.providerId) return block('identity_required');
 if (r.actorOrganizationId !== r.organizationId || !r.permissions.includes('creator.generate')) return block('rbac_or_tenant_denied');
 if (!r.capabilityVerified) return block('provider_unverified');
 if (!Number.isSafeInteger(r.estimatedCostMinor) || r.estimatedCostMinor < 0 ||
     !Number.isSafeInteger(r.approvedCostMinor) || r.approvedCostMinor < 0) return block('invalid_cost');
 if (!r.approvalId || r.approvalOrganizationId !== r.organizationId ||
     r.approvalProductionId !== r.productionId || r.estimatedCostMinor > r.approvedCostMinor) return block('spend_not_approved');
 if (!r.idempotencyKey || r.idempotencyKey.length > 128 || forbidden.test(r.idempotencyKey)) return block('invalid_idempotency_key');
 if (r.referenceAssetIds.length !== r.referenceOrganizationIds.length ||
     r.referenceOrganizationIds.some(id => id !== r.organizationId)) return block('cross_tenant_reference');
 if (r.referenceAssetIds.some(id => !id || forbidden.test(id))) return block('invalid_reference');
 if (!r.auditReady) return block('audit_unavailable');
 // A caller must never interpret preflight as provider acceptance or completion.
 return { status: 'preflight-only', idempotencyKey: r.idempotencyKey, estimatedCostMinor: r.estimatedCostMinor };
}
