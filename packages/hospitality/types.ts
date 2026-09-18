export type HospitalityPermission =
  | 'hospitality.access.read'
  | 'hospitality.access.issue'
  | 'hospitality.access.revoke'
  | 'hospitality.access.configure'
  | 'hospitality.access.audit'
  | 'hospitality.access.admin'
  | 'hospitality.pms.read'
  | 'hospitality.pms.configure'
  | 'hospitality.pms.sync'
  | 'hospitality.wallet.read'
  | 'hospitality.wallet.issue'
  | 'hospitality.wallet.revoke'
  | 'hospitality.wallet.configure'
  | 'hospitality.wallet.audit'
  | 'hospitality.wallet.automation.manage';

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

export type HospitalityPmsProviderType =
  | 'oracle_opera_cloud'
  | 'mews'
  | 'cloudbeds'
  | 'infor_hms'
  | 'generic_certified_pms';

export type HospitalityPmsCapability =
  | 'reservation.read'
  | 'reservation.events'
  | 'guest.reference.read'
  | 'checkin.read'
  | 'checkout.read'
  | 'room.assignment.read'
  | 'room.change.events'
  | 'property.read';

export type WalletPlatform = 'apple_wallet' | 'google_wallet' | 'provider_app' | 'none';

export type WalletState =
  | 'not_requested'
  | 'eligible'
  | 'provisioning_ready'
  | 'provisioned'
  | 'revoked'
  | 'expired'
  | 'failed'
  | 'unknown';

export type HospitalityStayStatus =
  | 'reserved'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'unknown';

export type HospitalityIntegrationEventType =
  | 'reservation.created'
  | 'reservation.updated'
  | 'reservation.cancelled'
  | 'stay.checkin_confirmed'
  | 'stay.checkout_confirmed'
  | 'room.assigned'
  | 'room.changed'
  | 'room.unassigned'
  | 'wallet.credential.requested'
  | 'wallet.credential.issued'
  | 'wallet.provisioning.ready'
  | 'wallet.provisioning.completed'
  | 'wallet.credential.revoked'
  | 'wallet.credential.expired'
  | 'wallet.credential.failed';

export type HospitalityAutomationPolicySnapshot = {
  id: string;
  organizationId: string;
  propertyId: string;
  version: number;
  enabled: boolean;
  autoWalletKeyOnCheckin: boolean;
  allowedPlatforms: Array<'apple_wallet' | 'google_wallet'>;
  allowedAccessScopes: string[];
  activationLeadMinutes: number;
  credentialExpiryOffsetMinutes: number;
  roomChangeMode: 'provider_safe_sequence';
  maxRetryAttempts: number;
  manualReviewOnFailure: boolean;
  emergencyKillSwitch: boolean;
};

export type HospitalityCapability =
  | 'credential.issue'
  | 'credential.revoke'
  | 'credential.status'
  | 'room.list'
  | 'room.mapping.verify'
  | 'mobile_key.issue'
  | 'rfid_reference.issue'
  | 'audit.read'
  | 'wallet.apple.issue'
  | 'wallet.apple.provision'
  | 'wallet.google.issue'
  | 'wallet.google.provision'
  | 'wallet.revoke'
  | 'wallet.status'
  | 'reservation.checkin.consume'
  | 'reservation.checkout.consume'
  | 'room.assignment.sync'
  | 'room.assignment.change.consume'
  | 'credential.replace';

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
