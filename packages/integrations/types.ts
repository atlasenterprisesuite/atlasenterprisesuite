import type { TenantScope } from '../core/src/scope';

export type IntegrationPermission =
  | 'integrations.view'
  | 'integrations.use'
  | 'integrations.manage'
  | 'infrastructure.integrations.manage';

export type IntegrationConnectionStatus =
  | 'not_connected'
  | 'authorizing'
  | 'connected_unverified'
  | 'verified'
  | 'degraded'
  | 'expired'
  | 'reconnect_required'
  | 'revoked'
  | 'error';

export type IntegrationCapability =
  | 'microsoft.profile.read'
  | 'microsoft.mail.read'
  | 'microsoft.calendar.read'
  | 'microsoft.files.read'
  | 'google.gmail.read'
  | 'google.calendar.read'
  | 'google.drive.read'
  | 'github.repositories.read'
  | 'github.pull_requests.read'
  | 'cloudflare.dns.read'
  | 'cloudflare.workers.read'
  | 'supabase.project.read';

export type IntegrationConnectorClass = 'user_oauth' | 'infrastructure';
export type IntegrationEnvironment = 'development' | 'staging' | 'production';

export type IntegrationActorContext = TenantScope & {
  userId: string;
  role: string;
  permissions: IntegrationPermission[];
};

export type IntegrationConnection = TenantScope & {
  id: string;
  userId: string | null;
  providerKey: string;
  connectorClass: IntegrationConnectorClass;
  environment: IntegrationEnvironment | null;
  status: IntegrationConnectionStatus;
  grantedScopes: string[];
  maskedIdentity: string | null;
  lastVerifiedAt: string | null;
};

export type IntegrationGrant = {
  connectionId: string;
  principalType: 'user' | 'role' | 'module';
  principalId: string;
  module: string;
  capability: IntegrationCapability;
};

export type CapabilityRequest = {
  module: string;
  capability: IntegrationCapability;
};

export type CapabilityDecision = { allowed: true };

export type ProviderDefinition = {
  providerKey: string;
  displayName: string;
  connectorClass: IntegrationConnectorClass;
  capabilities: Partial<Record<IntegrationCapability, readonly string[]>>;
};
