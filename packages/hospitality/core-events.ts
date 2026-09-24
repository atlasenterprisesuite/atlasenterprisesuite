export type HospitalityPropertyContextSelectedEvent = {
  type: 'hospitality.property.context_selected';
  organizationId: string;
  propertyId: string;
  actorId: string;
  occurredAt: string;
};

export type HospitalityAuditResult = 'success' | 'failure' | 'blocked';
export type HospitalityPermissionDecision = 'allowed' | 'denied';

export type HospitalityAuditEnvelope = {
  eventId: string;
  organizationId: string;
  propertyId?: string;
  outletId?: string;
  actorId: string;
  action: string;
  subjectId: string;
  timestamp: string;
  permissionDecision: HospitalityPermissionDecision;
  result: HospitalityAuditResult;
  approvalReference?: string;
  evidenceReferences?: readonly string[];
};

function requireNonBlank(value: string, label: string) {
  if (!value.trim()) {
    throw new Error(`${label}_required`);
  }
}

export function createPropertyContextSelectedEvent(input: Omit<HospitalityPropertyContextSelectedEvent, 'type'>): HospitalityPropertyContextSelectedEvent {
  requireNonBlank(input.organizationId, 'organization');
  requireNonBlank(input.propertyId, 'property');
  requireNonBlank(input.actorId, 'actor');
  requireNonBlank(input.occurredAt, 'occurred_at');

  return Object.freeze({
    type: 'hospitality.property.context_selected',
    ...input
  });
}

export function createHospitalityAuditEnvelope(input: HospitalityAuditEnvelope): HospitalityAuditEnvelope {
  requireNonBlank(input.eventId, 'event');
  requireNonBlank(input.organizationId, 'organization');
  requireNonBlank(input.actorId, 'actor');
  requireNonBlank(input.action, 'action');
  requireNonBlank(input.subjectId, 'subject');
  requireNonBlank(input.timestamp, 'timestamp');

  if (input.propertyId !== undefined) {
    requireNonBlank(input.propertyId, 'property');
  }

  return Object.freeze({
    ...input,
    evidenceReferences: input.evidenceReferences ? Object.freeze([...input.evidenceReferences]) : undefined
  });
}
