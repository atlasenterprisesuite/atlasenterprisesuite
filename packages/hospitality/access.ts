export type HospitalityPermission =
  | 'hospitality.access.read'
  | 'hospitality.access.issue'
  | 'hospitality.access.revoke'
  | 'hospitality.access.admin'
  | 'audit.read';

export type AccessProviderState = 'not_configured' | 'ready' | 'degraded' | 'offline';

export type HospitalityActorContext = {
  organizationId: string;
  userId: string;
  permissions: readonly HospitalityPermission[];
};

export type RoomAccessRequest = {
  propertyId: string;
  roomId: string;
  assignmentReference: string;
  startsAt: string;
  expiresAt: string;
  reason: 'guest_checkin' | 'replacement' | 'staff_authorized';
};

export type RoomAccessDecision = {
  allowed: boolean;
  reasons: string[];
};

export type RoomAccessAuditEvent = {
  eventType: 'hospitality.room_access.issue_requested';
  organizationId: string;
  actorId: string;
  propertyId: string;
  roomId: string;
  assignmentReference: string;
  startsAt: string;
  expiresAt: string;
  reason: RoomAccessRequest['reason'];
};

export interface AuthorizedRoomAccessProvider {
  readonly providerId: string;
  readonly state: AccessProviderState;
  issueCredential(input: RoomAccessRequest): Promise<{ providerCredentialId: string }>;
  revokeCredential(providerCredentialId: string): Promise<void>;
}

export function hasHospitalityPermission(
  context: HospitalityActorContext,
  permission: HospitalityPermission
) {
  return context.permissions.includes('hospitality.access.admin') || context.permissions.includes(permission);
}

export function evaluateRoomAccessRequest(
  context: HospitalityActorContext,
  providerState: AccessProviderState,
  request: RoomAccessRequest
): RoomAccessDecision {
  const reasons: string[] = [];

  if (!context.organizationId.trim()) reasons.push('organization_required');
  if (!context.userId.trim()) reasons.push('actor_required');
  if (!hasHospitalityPermission(context, 'hospitality.access.issue')) reasons.push('permission_required');
  if (providerState !== 'ready') reasons.push('authorized_provider_not_ready');
  if (!request.propertyId.trim()) reasons.push('property_required');
  if (!request.roomId.trim()) reasons.push('room_required');
  if (!request.assignmentReference.trim()) reasons.push('assignment_reference_required');

  const startsAt = Date.parse(request.startsAt);
  const expiresAt = Date.parse(request.expiresAt);
  if (!Number.isFinite(startsAt)) reasons.push('valid_start_required');
  if (!Number.isFinite(expiresAt)) reasons.push('valid_expiry_required');
  if (Number.isFinite(startsAt) && Number.isFinite(expiresAt) && expiresAt <= startsAt) {
    reasons.push('expiry_must_follow_start');
  }

  return { allowed: reasons.length === 0, reasons };
}

export function buildRoomAccessAuditEvent(
  context: HospitalityActorContext,
  request: RoomAccessRequest
): RoomAccessAuditEvent {
  return {
    eventType: 'hospitality.room_access.issue_requested',
    organizationId: context.organizationId,
    actorId: context.userId,
    propertyId: request.propertyId,
    roomId: request.roomId,
    assignmentReference: request.assignmentReference,
    startsAt: request.startsAt,
    expiresAt: request.expiresAt,
    reason: request.reason
  };
}
