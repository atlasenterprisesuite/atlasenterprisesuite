export type ConnectedAppState =
  | 'disconnected'
  | 'authorizing'
  | 'connected'
  | 'degraded'
  | 'expired'
  | 'revoked'
  | 'error';

export type ConnectedAppAccessLevel = 'read' | 'write' | 'admin' | 'consequential';
export type ConnectedAppPolicyEffect = 'allow' | 'approval_required' | 'deny';
export type ConnectedAppActorKind = 'user' | 'agent' | 'workflow' | 'any';
export type ConnectedAppAuthKind = 'oauth2' | 'oidc' | 'service_jwt' | 'signed_token' | 'password';
export type ConnectedAppRuntimeStatus = 'ready' | 'catalog_only' | 'unavailable';

export type ProviderCapabilityManifest = {
  code: string;
  accessLevel: ConnectedAppAccessLevel;
  providerScopes: readonly string[];
};

export type ProviderManifest = {
  providerId: string;
  displayName: string;
  authKinds: readonly ConnectedAppAuthKind[];
  runtimeStatus: ConnectedAppRuntimeStatus;
  capabilities: readonly ProviderCapabilityManifest[];
  supportsReadinessProbe: boolean;
  supportsTokenRefresh: boolean;
  supportsDisconnect: boolean;
  supportsDeletionRequest: boolean;
  adapterVersion: number;
};

export type ConnectedAppPolicy = {
  capabilityPattern: string;
  effect: ConnectedAppPolicyEffect;
  actorKind: ConnectedAppActorKind;
  enabled: boolean;
  connectionId?: string | null;
};

export type ConnectedAppAccessInput = {
  capabilityCode: string;
  accessLevel: ConnectedAppAccessLevel;
  actorKind: Exclude<ConnectedAppActorKind, 'any'>;
  policies: readonly ConnectedAppPolicy[];
};

export type ConnectedAppAccessDecision = {
  effect: ConnectedAppPolicyEffect;
  reason: string;
};

export type ConnectedAppSafeErrorCode =
  | 'connection_not_authorized'
  | 'connection_not_verified'
  | 'connection_expired'
  | 'scope_missing'
  | 'capability_not_supported'
  | 'permission_denied'
  | 'approval_required'
  | 'approval_invalid'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'provider_request_failed'
  | 'credential_unavailable'
  | 'organization_mismatch';

export type ConnectedAppSafeError = {
  code: ConnectedAppSafeErrorCode;
  message: string;
};
