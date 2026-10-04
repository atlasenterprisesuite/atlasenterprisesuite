export const MVNO_SUBSCRIBER_STATES = [
  'not_configured',
  'pending_provider',
  'provisioning',
  'active',
  'degraded',
  'offline',
  'suspended',
  'revoked'
] as const;

export type MvnoSubscriberState = (typeof MVNO_SUBSCRIBER_STATES)[number];

export const MVNO_PROVIDER_STATES = [
  'not_configured',
  'pending_provider',
  'configured_unverified',
  'ready',
  'degraded',
  'offline',
  'disabled'
] as const;

export type MvnoProviderState = (typeof MVNO_PROVIDER_STATES)[number];

export const MVNO_CAPABILITIES = [
  'esim',
  'voice',
  'sms_mms',
  'mobile_data',
  'hotspot',
  'number_management',
  'usage_events',
  'e911'
] as const;

export type MvnoCapability = (typeof MVNO_CAPABILITIES)[number];

export const MVNO_PERMISSIONS = [
  'wireless.mvno.read',
  'wireless.mvno.provision',
  'wireless.mvno.activate',
  'wireless.mvno.suspend',
  'wireless.mvno.reconnect',
  'wireless.mvno.revoke',
  'wireless.mvno.audit',
  'wireless.mvno.admin'
] as const;

export type MvnoPermission = (typeof MVNO_PERMISSIONS)[number];

export interface MvnoProviderContext {
  organizationId: string;
  tenantId: string;
  userId: string;
  providerInstanceId: string;
  correlationId: string;
  idempotencyKey: string;
  permissions: readonly MvnoPermission[];
}

export interface MvnoSubscriberIdentifiers {
  eid?: string;
  imei?: string;
  iccid?: string;
  imsi?: string;
  msisdn?: string;
}

export interface MvnoSubscriber {
  id: string;
  state: MvnoSubscriberState;
  identifiers: MvnoSubscriberIdentifiers;
  provider?: string;
  lastVerifiedAt?: string;
}

export interface MvnoProvisionRequest {
  subscriberId: string;
  eid?: string;
  imei?: string;
  requestedCapabilities: MvnoCapability[];
}

export interface MvnoProviderReadiness {
  state: MvnoProviderState;
  blocker: string | null;
  checkedAt: string;
  capabilities: readonly MvnoCapability[];
  providerStatusCode?: number | null;
}

export interface MvnoProviderEvidence {
  providerState: MvnoProviderState;
  checkedAt: string;
  providerRequestId?: string;
}

export type MvnoActiveSubscriber = Omit<MvnoSubscriber, 'state'> & { state: 'active' };
export type MvnoNonActiveSubscriber = Omit<MvnoSubscriber, 'state'> & {
  state: Exclude<MvnoSubscriberState, 'active'>;
};

export interface MvnoActiveMutationResult {
  subscriber: MvnoActiveSubscriber;
  evidence: MvnoProviderEvidence & { providerState: 'ready' };
}

export interface MvnoNonActiveMutationResult {
  subscriber: MvnoNonActiveSubscriber;
  evidence: MvnoProviderEvidence;
}

export type MvnoMutationResult = MvnoActiveMutationResult | MvnoNonActiveMutationResult;
export type MvnoMutationResultCandidate = {
  subscriber: MvnoSubscriber;
  evidence: MvnoProviderEvidence;
};

export type MvnoProvisionResult = MvnoMutationResult & {
  activationReference?: string;
};

export interface MvnoProviderAdapter {
  readonly providerId: string;
  readonly capabilities: ReadonlySet<MvnoCapability>;

  readiness(context: MvnoProviderContext): Promise<MvnoProviderReadiness>;
  provision(context: MvnoProviderContext, request: MvnoProvisionRequest): Promise<MvnoProvisionResult>;
  getSubscriber(context: MvnoProviderContext, subscriberId: string): Promise<MvnoSubscriber>;
  activate(context: MvnoProviderContext, subscriberId: string): Promise<MvnoMutationResult>;
  suspend(context: MvnoProviderContext, subscriberId: string): Promise<MvnoMutationResult>;
  reconnect(context: MvnoProviderContext, subscriberId: string): Promise<MvnoMutationResult>;
  revoke(context: MvnoProviderContext, subscriberId: string): Promise<MvnoMutationResult>;
}

const REQUIRED_CONTEXT_FIELDS = [
  'organizationId',
  'tenantId',
  'userId',
  'providerInstanceId',
  'correlationId',
  'idempotencyKey'
] as const;

const MVNO_ALLOWED_TRANSITIONS: Readonly<Record<MvnoSubscriberState, readonly MvnoSubscriberState[]>> = {
  not_configured: ['pending_provider', 'revoked'],
  pending_provider: ['provisioning', 'revoked'],
  provisioning: ['active', 'degraded', 'offline', 'suspended', 'revoked'],
  active: ['degraded', 'offline', 'suspended', 'revoked'],
  degraded: ['active', 'offline', 'suspended', 'revoked'],
  offline: ['active', 'degraded', 'suspended', 'revoked'],
  suspended: ['active', 'degraded', 'offline', 'revoked'],
  revoked: []
};

export function assertMvnoProviderContext(context: MvnoProviderContext): void {
  for (const field of REQUIRED_CONTEXT_FIELDS) {
    if (!context[field]?.trim()) throw new Error(`mvno_context_required:${field}`);
  }
}

export function requireMvnoPermission(
  context: MvnoProviderContext,
  permission: MvnoPermission
): void {
  if (!context.permissions.includes(permission) && !context.permissions.includes('wireless.mvno.admin')) {
    throw new Error(`mvno_permission_denied:${permission}`);
  }
}

export function assertMvnoActivationAllowed(readiness: MvnoProviderReadiness): void {
  if (readiness.state !== 'ready') {
    throw new Error(`mvno_provider_not_ready:${readiness.state}`);
  }
}

export function assertMvnoMutationResult(
  result: MvnoMutationResultCandidate
): asserts result is MvnoMutationResult {
  if (result.subscriber.state === 'active' && result.evidence.providerState !== 'ready') {
    throw new Error(`mvno_active_without_ready_provider:${result.evidence.providerState}`);
  }
}

export function assertMvnoSubscriberTransition(
  currentState: MvnoSubscriberState,
  nextState: MvnoSubscriberState,
  readiness: MvnoProviderReadiness
): void {
  if (currentState !== nextState && !MVNO_ALLOWED_TRANSITIONS[currentState].includes(nextState)) {
    throw new Error(`mvno_invalid_transition:${currentState}->${nextState}`);
  }
  if (nextState === 'active') assertMvnoActivationAllowed(readiness);
}
