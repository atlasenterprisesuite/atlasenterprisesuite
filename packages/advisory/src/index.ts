export const AW_FINANCE_FIRM = {
  id: 'aw-finance-advisory-solutions',
  firmNumber: '001',
  name: 'AW Finance Advisory Solutions',
  status: 'active',
  platform: 'ATLAS Advisory Office'
} as const;

export type AdvisoryRole =
  | 'firm_owner' | 'firm_admin' | 'advisor' | 'accountant_bookkeeper'
  | 'reviewer' | 'staff' | 'billing' | 'client' | 'client_delegate' | 'read_only_auditor';

export type AdvisoryPermission =
  | 'advisory.read' | 'advisory.manage' | 'advisory.write' | 'advisory.billing'
  | 'advisory.compliance' | 'advisory.automations' | 'advisory.admin';

export type EngagementStatus = 'lead' | 'open' | 'review' | 'billing' | 'closed';

export type AdvisoryFirm = {
  id: string; organizationId: string; firmNumber: string; name: string;
  status: 'active' | 'inactive'; platform: 'ATLAS Advisory Office';
};

export type AdvisoryClient = {
  id: string; organizationId: string; firmId: string; displayName: string;
  status: 'prospect' | 'active' | 'inactive'; ownerId: string | null;
};

export type AdvisoryEngagement = {
  id: string; organizationId: string; firmId: string; clientId: string;
  serviceId: string; title: string; status: EngagementStatus;
  ownerId: string | null; createdAt: string; updatedAt: string;
};

export type LaunchPhase =
  | 'foundation' | 'brand' | 'website' | 'crm_sales'
  | 'brand_print_promo' | 'marketing' | 'launch' | 'review_30_day';

export const LAUNCH_READINESS_DIMENSIONS = [
  'business_setup','brand','website','contact_channels','crm',
  'payments','accounting','marketing','compliance','analytics'
] as const;

export type LaunchEvidenceDimension = typeof LAUNCH_READINESS_DIMENSIONS[number];
export type ReadinessEvidence = Record<LaunchEvidenceDimension, boolean>;

export const BUSINESS_LAUNCH_360 = {
  id: 'business-launch-360',
  name: 'Business Launch 360',
  phases: ['foundation','brand','website','crm_sales','brand_print_promo','marketing','launch','review_30_day'] as const,
  billingModel: ['launch_fee','monthly_growth_management','media_spend','print_production_cost'] as const
};

export const BRAND_PRINT_PROMO_DELIVERABLES = [
  'logo_system','brand_kit','business_cards','flyers_brochures','posters_banners',
  'uniforms_apparel','stickers_labels','promotional_items','qr_assets',
  'storefront_vehicle_concepts','sales_offer_assets'
] as const;

export function calculateLaunchReadiness(evidence: ReadinessEvidence) {
  const entries = Object.entries(evidence) as [LaunchEvidenceDimension, boolean][];
  const verified = entries.filter(([, value]) => value).map(([dimension]) => dimension);
  return { score: verified.length * 10, verified, missing: entries.filter(([, value]) => !value).map(([dimension]) => dimension) };
}

export function assertAdvisoryScope(
  actor: { organizationId: string; firmId: string },
  resource: { organizationId: string; firmId: string }
) {
  if (actor.organizationId !== resource.organizationId) return { ok: false as const, reason: 'organization_mismatch' as const };
  if (actor.firmId !== resource.firmId) return { ok: false as const, reason: 'firm_mismatch' as const };
  return { ok: true as const };
}

export type BillingBridgeEvent = {
  type: 'accounting.invoice.approved' | 'accounting.payment.received';
  organizationId: string; firmId: string; clientId: string; engagementId: string;
  externalReference: string;
};

export type PromoOrderState = 'draft' | 'proof_pending' | 'proof_approved' | 'ordered' | 'fulfilled' | 'cancelled';

export function canAdvancePromoOrder(from: PromoOrderState, to: PromoOrderState) {
  const allowed: Record<PromoOrderState, readonly PromoOrderState[]> = {
    draft: ['proof_pending','cancelled'],
    proof_pending: ['proof_approved','cancelled'],
    proof_approved: ['ordered','cancelled'],
    ordered: ['fulfilled','cancelled'],
    fulfilled: [],
    cancelled: []
  };
  return allowed[from].includes(to);
}
