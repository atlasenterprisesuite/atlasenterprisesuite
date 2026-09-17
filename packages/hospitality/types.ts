export type HospitalityPermission =
  | 'hospitality.access.read'
  | 'hospitality.access.issue'
  | 'hospitality.access.revoke'
  | 'hospitality.access.configure'
  | 'hospitality.access.audit'
  | 'hospitality.access.admin';

export const PROVIDER_STATES = [
  'not_configured',
  'configured_unverified',
  'ready',
  'degraded',
  'offline',
  'disabled'
] as const;

export type HospitalityProviderState = (typeof PROVIDER_STATES)[number];

export type HospitalityProviderType =
  | 'salto_ks'
  | 'salto_space_hospitality'
  | 'vingcard_vconnect'
  | 'vingcard_vostio'
  | 'vingcard_visionline'
  | 'dormakaba_ambiance_cloud'
  | 'dormakaba_ambiance_soap'
  | 'dormakaba_ambiance_rest'
  | 'dormakaba_pms_bridge'
  | 'onity'
  | 'generic_certified';

export type HospitalityCapability =
  | 'credential.issue'
  | 'credential.revoke'
  | 'credential.status'
  | 'room.list'
  | 'room.mapping.verify'
  | 'mobile_key.issue'
  | 'rfid_reference.issue'
  | 'audit.read';

export type HospitalityActorContext = {
  organizationId: string;
  userId: string;
  permissions: readonly HospitalityPermission[];
};

export type ProviderContext = {
  organizationId: string;
  propertyId: string;
  userId: string;
  providerInstanceId: string;
  providerPropertyId: string;
};

export type ProviderReadiness = {
  state: HospitalityProviderState;
  blocker: string | null;
  checkedAt: string;
  capabilities: readonly HospitalityCapability[];
  providerStatusCode?: number | null;
};

export type RoomAccessReason = 'guest_checkin' | 'replacement' | 'staff_authorized';

export type RoomAccessRequest = {
  propertyId: string;
  roomId: string;
  assignmentReference: string;
  startsAt: string;
  expiresAt: string;
  reason: RoomAccessReason;
};

export type IssueCredentialRequest = RoomAccessRequest & {
  providerRoomId: string;
  credentialType?: 'mobile_key' | 'rfid_reference';
};

export type IssueCredentialResult = {
  providerCredentialId: string;
  state: 'issued';
  providerStatusCode?: number | null;
};

export type RevokeCredentialRequest = {
  providerCredentialId: string;
  propertyId: string;
  roomId: string;
  reason: string;
};

export type RevokeCredentialResult = {
  providerCredentialId: string;
  state: 'revoked';
  providerStatusCode?: number | null;
};

export type CredentialStatusResult = {
  providerCredentialId: string;
  state: 'issued' | 'revoked' | 'expired' | 'failed' | 'unknown';
  providerStatusCode?: number | null;
};

export interface HospitalityAccessAdapter {
  readonly providerType: HospitalityProviderType;
  readonly capabilities: readonly HospitalityCapability[];
  readiness(context: ProviderContext): Promise<ProviderReadiness>;
  issueCredential(context: ProviderContext, request: IssueCredentialRequest): Promise<IssueCredentialResult>;
  revokeCredential(context: ProviderContext, request: RevokeCredentialRequest): Promise<RevokeCredentialResult>;
  credentialStatus?(context: ProviderContext, providerCredentialId: string): Promise<CredentialStatusResult>;
}
