import type {
  AtlasCallDirection,
  AtlasCallRequest,
  AtlasTelephonyProviderReadiness
} from './types';

export type AtlasTelephonyProvider = {
  readonly name: string;
  readiness(): Promise<AtlasTelephonyProviderReadiness>;
  startCall(input: AtlasCallRequest): Promise<{
    providerCallId: string;
    state: 'dialing' | 'ringing' | 'connected';
  }>;
  endCall(providerCallId: string): Promise<void>;
};

export class AtlasTelephonyNotReadyError extends Error {
  constructor(message = 'atlas_telephony_provider_not_verified') {
    super(message);
    this.name = 'AtlasTelephonyNotReadyError';
  }
}

export async function requireVerifiedTelephony(
  provider: AtlasTelephonyProvider,
  direction: AtlasCallDirection
): Promise<AtlasTelephonyProviderReadiness> {
  const readiness = await provider.readiness();
  const directionEnabled =
    direction === 'inbound'
      ? readiness.capabilities.inbound
      : readiness.capabilities.outbound;

  if (readiness.state !== 'verified' || !directionEnabled) {
    throw new AtlasTelephonyNotReadyError(
      readiness.reason || 'atlas_telephony_provider_not_verified'
    );
  }

  return readiness;
}

export async function startVerifiedAtlasCall(
  provider: AtlasTelephonyProvider,
  input: AtlasCallRequest
) {
  await requireVerifiedTelephony(provider, input.direction);

  if (!input.organizationId || !input.actorId) {
    throw new AtlasTelephonyNotReadyError('atlas_telephony_identity_required');
  }

  if (!input.to?.trim()) {
    throw new AtlasTelephonyNotReadyError('atlas_telephony_destination_required');
  }

  if (!input.purpose?.trim()) {
    throw new AtlasTelephonyNotReadyError('atlas_telephony_purpose_required');
  }

  if (input.requestedRecording && !input.consentReference) {
    throw new AtlasTelephonyNotReadyError('atlas_telephony_recording_consent_required');
  }

  return provider.startCall(input);
}
