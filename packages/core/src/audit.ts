import type { TenantScope } from './scope';
import type {
  StewardshipAssurance,
  StewardshipDecisionReason,
  StewardshipRisk
} from './stewardship';

export type AuditResult = 'success' | 'denied' | 'failed';

export type StewardshipAuditMetadata = {
  purpose: string;
  stewardshipRisk: StewardshipRisk;
  assurance: StewardshipAssurance;
  policyDecision: StewardshipDecisionReason;
  evidenceRefs: readonly string[];
  correlationId: string;
};

export function createStewardshipAuditMetadata(
  input: StewardshipAuditMetadata
): StewardshipAuditMetadata {
  const evidenceRefs = Object.freeze(
    [...new Set(input.evidenceRefs.map(value => String(value).trim()).filter(Boolean))]
  );

  return Object.freeze({
    purpose: input.purpose.trim(),
    stewardshipRisk: input.stewardshipRisk,
    assurance: input.assurance,
    policyDecision: input.policyDecision,
    evidenceRefs,
    correlationId: input.correlationId.trim()
  });
}

export type AtlasAuditEvent = {
  scope: TenantScope;
  actorId: string;
  action: string;
  resource: string;
  result: AuditResult;
  occurredAt: string;
  evidenceRef?: string;
  stewardship?: StewardshipAuditMetadata;
};

export function createAuditEvent(event: AtlasAuditEvent): AtlasAuditEvent {
  return Object.freeze({
    ...event,
    scope: Object.freeze({ ...event.scope }),
    ...(event.stewardship
      ? { stewardship: createStewardshipAuditMetadata(event.stewardship) }
      : {})
  });
}
