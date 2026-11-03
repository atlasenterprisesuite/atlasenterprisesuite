/** ATLAS Growth Engine F1 — pure, deterministic lead qualification. No network or persistence. */
export type LeadStage = 'new' | 'qualified' | 'enrolled' | 'customer';
export interface GrowthLead {
  tenantId: string;
  leadId: string;
  stage: LeadStage;
  consentToContact: boolean;
  verifiedTenantAccess: boolean;
}
export type GrowthDecision =
  | { allowed: true; nextStage: LeadStage }
  | { allowed: false; reason: 'INVALID_INPUT' | 'ACCESS_DENIED' | 'CONSENT_REQUIRED' | 'INVALID_TRANSITION' };
const transitions: Readonly<Record<LeadStage, readonly LeadStage[]>> = {
  new: ['qualified'], qualified: ['enrolled'], enrolled: ['customer'], customer: []
};
export function transitionGrowthLead(lead: GrowthLead, requested: LeadStage, actorTenantId: string): GrowthDecision {
  if (!lead || typeof lead.tenantId !== 'string' || !lead.tenantId.trim() ||
      typeof lead.leadId !== 'string' || !lead.leadId.trim() ||
      !Object.prototype.hasOwnProperty.call(transitions, lead.stage) ||
      !Object.prototype.hasOwnProperty.call(transitions, requested)) {
    return { allowed: false, reason: 'INVALID_INPUT' };
  }
  if (!lead.verifiedTenantAccess || !actorTenantId || lead.tenantId !== actorTenantId) {
    return { allowed: false, reason: 'ACCESS_DENIED' };
  }
  if (!lead.consentToContact && requested !== 'qualified') {
    return { allowed: false, reason: 'CONSENT_REQUIRED' };
  }
  if (!transitions[lead.stage].includes(requested)) {
    return { allowed: false, reason: 'INVALID_TRANSITION' };
  }
  return { allowed: true, nextStage: requested };
}
