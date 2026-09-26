export type AtlasCallDirection = 'inbound' | 'outbound';

export type AtlasCallState =
  | 'draft'
  | 'queued'
  | 'dialing'
  | 'ringing'
  | 'connected'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'blocked';

export type AtlasTelephonyProviderState =
  | 'not_configured'
  | 'configured'
  | 'verified'
  | 'degraded'
  | 'blocked';

export type AtlasTelephonyCapability = {
  inbound: boolean;
  outbound: boolean;
  sms: boolean;
  recording: boolean;
  realtimeAudio: boolean;
  transfer: boolean;
  emergencyCalling: boolean;
};

export type AtlasTelephonyProviderReadiness = {
  provider: string;
  state: AtlasTelephonyProviderState;
  verifiedAt: string | null;
  capabilities: AtlasTelephonyCapability;
  reason: string | null;
};

export type AtlasCallRequest = {
  organizationId: string;
  actorId: string;
  direction: AtlasCallDirection;
  from: string | null;
  to: string;
  purpose: string;
  consentReference: string | null;
  requestedRecording: boolean;
};

export type AtlasCallSession = {
  id: string;
  organizationId: string;
  actorId: string;
  provider: string | null;
  providerCallId: string | null;
  direction: AtlasCallDirection;
  from: string | null;
  to: string;
  purpose: string;
  state: AtlasCallState;
  consentReference: string | null;
  recordingEnabled: boolean;
  createdAt: string;
  connectedAt: string | null;
  endedAt: string | null;
};

export function canStartAtlasCall(
  readiness: AtlasTelephonyProviderReadiness,
  direction: AtlasCallDirection
): boolean {
  if (readiness.state !== 'verified') return false;
  return direction === 'inbound'
    ? readiness.capabilities.inbound
    : readiness.capabilities.outbound;
}
