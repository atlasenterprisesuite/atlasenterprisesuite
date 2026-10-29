export type DataClass = 'public' | 'internal' | 'confidential' | 'restricted';

export interface GenomePattern {
  patternId: string;
  version: string;
  owner: string;
  capability: string;
  compatibleModules: readonly string[];
  dependencies: readonly string[];
  tenantScope: 'organization';
  requiredPermissions: readonly string[];
  dataClassification: DataClass;
  consentRequired: boolean;
  negativeTests: readonly string[];
  evidenceRefs: readonly string[];
}

export interface AdaptationRequest {
  pattern: GenomePattern;
  targetModule: string;
  organizationId: string | null;
  actorId: string | null;
  actorPermissions: readonly string[];
  hasConsent: boolean;
}

export type AdaptationDecision =
  | { allowed: true; state: 'PROPOSAL_ONLY'; patternId: string; targetModule: string }
  | { allowed: false; state: 'BLOCKED'; reason: string };

export function evaluateAdaptation(request: AdaptationRequest): AdaptationDecision {
  const { pattern, targetModule } = request;
  const blocked = (reason: string): AdaptationDecision => ({ allowed: false, state: 'BLOCKED', reason });
  if (!pattern.patternId.trim() || !pattern.version.trim() || !pattern.owner.trim()) return blocked('INVALID_PATTERN');
  if (!request.organizationId?.trim() || !request.actorId?.trim()) return blocked('UNBOUND_IDENTITY');
  if (pattern.tenantScope !== 'organization') return blocked('UNSUPPORTED_TENANT_SCOPE');
  if (!pattern.compatibleModules.includes(targetModule)) return blocked('INCOMPATIBLE_MODULE');
  if (pattern.requiredPermissions.length === 0 || !pattern.requiredPermissions.every(p => request.actorPermissions.includes(p))) return blocked('MISSING_PERMISSION');
  if (pattern.consentRequired && !request.hasConsent) return blocked('MISSING_CONSENT');
  if (pattern.negativeTests.length === 0 || pattern.evidenceRefs.length === 0) return blocked('MISSING_EVIDENCE');
  return { allowed: true, state: 'PROPOSAL_ONLY', patternId: pattern.patternId, targetModule };
}
