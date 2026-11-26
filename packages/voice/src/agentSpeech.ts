import { authorize, type AuthorizationContext } from '../../core/src/permissions';
import type { VoiceProfile, VoiceProviderCapabilities } from './types';

/** ATLAS owns identity, consent, routing and audit; adapters never own authorization. */
export type SpeechPurpose = 'assistant_private' | 'studio_preview' | 'narration_export' | 'public_release' | 'telephony';
export type SpeechStyle = 'neutral' | 'documentary' | 'educational' | 'conversational' | 'energetic' | 'calm';
export type SpeechBackend = 'atlas_local' | 'external_adapter';

export type SpeechConsent = {
  profileId: string;
  ownerActorId: string;
  version: string;
  permittedPurposes: readonly SpeechPurpose[];
  permittedConsumers: readonly string[];
  acceptedAt: string;
  revokedAt: string | null;
};

export type AgentSpeechGrant = {
  profileId: string;
  ownerActorId: string;
  granteeActorId: string;
  consumerId: string;
  permittedPurposes: readonly SpeechPurpose[];
  permittedLocales: readonly string[];
  permittedStyles: readonly SpeechStyle[];
  expiresAt: string;
  revokedAt: string | null;
};

/** The provider reference is private server-side data, never shipped to an agent or Git. */
export type SpeechBinding = {
  profileId: string;
  backend: SpeechBackend;
  privateVoiceRef: string;
  status: 'ready' | 'pending' | 'suspended' | 'unavailable';
  capabilities: VoiceProviderCapabilities;
  verifiedLocales: readonly string[];
  verifiedStyles: readonly SpeechStyle[];
};

export type AgentSpeechRequest = {
  actorId: string;
  actor: AuthorizationContext;
  profile: VoiceProfile;
  consent: SpeechConsent | null;
  grant: AgentSpeechGrant | null;
  binding: SpeechBinding | null;
  consumerId: string;
  purpose: SpeechPurpose;
  locale: string;
  style: SpeechStyle;
  text: string;
  now: string;
  allowExternalProvider: boolean;
};

export type SpeechDenial =
  | 'invalid_request' | 'scope_mismatch' | 'permission_denied'
  | 'profile_unavailable' | 'owner_mismatch' | 'consent_required'
  | 'consent_revoked' | 'purpose_not_consented' | 'consumer_not_consented'
  | 'agent_grant_required' | 'agent_grant_revoked' | 'agent_grant_expired'
  | 'purpose_not_granted' | 'locale_not_granted' | 'style_not_granted'
  | 'provider_unavailable' | 'provider_capability_missing'
  | 'locale_unverified' | 'style_unverified' | 'external_provider_not_approved';

export type SpeechDecision =
  | { allowed: false; reason: SpeechDenial }
  | { allowed: true; backend: SpeechBackend; capability: keyof VoiceProviderCapabilities };

function validMoment(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && /^\d{4}-\d\d-\d\dT/.test(value) ? timestamp : null;
}

function exactLocale(value: string) {
  return /^(?:[a-z]{2,3})(?:-[A-Za-z0-9]{2,8}){0,2}$/.test(value);
}

function capabilityFor(purpose: SpeechPurpose): keyof VoiceProviderCapabilities {
  if (purpose === 'telephony') return 'telephony';
  if (purpose === 'narration_export' || purpose === 'public_release') return 'audioExport';
  return 'serverSynthesis';
}

/** Fail closed. An authenticated ATLAS session never automatically grants agent voice use.
 * The server must fetch consent, grant and provider binding from trusted persistence (not an agent body).
 */
export function authorizeAgentSpeech(input: AgentSpeechRequest): SpeechDecision {
  const { profile, actor, actorId, consent, grant, binding } = input;
  const now = validMoment(input.now);
  if (!now || !input.consumerId.trim() || !input.text.trim() || input.text.length > 4096 ||
      !exactLocale(input.locale) || !input.style || !input.purpose) {
    return { allowed: false, reason: 'invalid_request' };
  }
  const authorization = authorize(actor, {
    scope: { tenantId: profile.tenantId, organizationId: profile.organizationId },
    permission: 'voice.personal.use'
  });
  if (!authorization.ok) return { allowed: false, reason: authorization.reason };
  if (profile.status !== 'ready') return { allowed: false, reason: 'profile_unavailable' };
  if (!consent) return { allowed: false, reason: 'consent_required' };
  if (profile.ownerActorId !== consent.ownerActorId || consent.profileId !== profile.id) {
    return { allowed: false, reason: 'owner_mismatch' };
  }
  if (!consent.version || validMoment(consent.acceptedAt) === null ||
      (validMoment(consent.acceptedAt) ?? Infinity) > now) {
    return { allowed: false, reason: 'consent_required' };
  }
  if (consent.revokedAt !== null) return { allowed: false, reason: 'consent_revoked' };
  if (!consent.permittedPurposes.includes(input.purpose)) return { allowed: false, reason: 'purpose_not_consented' };
  if (!consent.permittedConsumers.includes(input.consumerId)) return { allowed: false, reason: 'consumer_not_consented' };
  // Every agent needs an explicit owner-scoped grant, even if the owner initiates the request.
  if (!grant || grant.profileId !== profile.id || grant.ownerActorId !== profile.ownerActorId ||
      grant.granteeActorId !== actorId || grant.consumerId !== input.consumerId) {
    return { allowed: false, reason: 'agent_grant_required' };
  }
  if (grant.revokedAt !== null) return { allowed: false, reason: 'agent_grant_revoked' };
  const expiry = validMoment(grant.expiresAt);
  if (expiry === null || now >= expiry) return { allowed: false, reason: 'agent_grant_expired' };
  if (!grant.permittedPurposes.includes(input.purpose)) return { allowed: false, reason: 'purpose_not_granted' };
  if (!grant.permittedLocales.includes(input.locale)) return { allowed: false, reason: 'locale_not_granted' };
  if (!grant.permittedStyles.includes(input.style)) return { allowed: false, reason: 'style_not_granted' };
  if (!binding || binding.profileId !== profile.id || binding.status !== 'ready' ||
      !binding.privateVoiceRef.trim()) return { allowed: false, reason: 'provider_unavailable' };
  if (binding.backend === 'external_adapter' && !input.allowExternalProvider) {
    return { allowed: false, reason: 'external_provider_not_approved' };
  }
  const capability = capabilityFor(input.purpose);
  if (!profile.capabilities.serverSynthesis || !binding.capabilities.serverSynthesis ||
      !binding.capabilities[capability] || !profile.capabilities[capability]) {
    return { allowed: false, reason: 'provider_capability_missing' };
  }
  if (!binding.verifiedLocales.includes(input.locale)) return { allowed: false, reason: 'locale_unverified' };
  if (!binding.verifiedStyles.includes(input.style)) return { allowed: false, reason: 'style_unverified' };
  return { allowed: true, backend: binding.backend, capability };
}

export type SpeechAudit = {
  actorId: string;
  consumerId: string;
  profileId: string;
  purpose: SpeechPurpose;
  action: 'voice.agent.authorize' | 'voice.agent.synthesized' | 'voice.agent.failed';
  result: 'allowed' | 'denied' | 'success' | 'failed';
  reason?: SpeechDenial | 'adapter_failed';
};

export type SpeechAdapter = {
  backend: SpeechBackend;
  synthesize(input: { privateVoiceRef: string; text: string; locale: string; style: SpeechStyle }): Promise<Uint8Array>;
};

/** Caller must supply a trusted audit sink and server-side configured synthesis adapter. */
export async function executeAgentSpeech(input: AgentSpeechRequest, dependencies: {
  audit: (event: SpeechAudit) => Promise<void>;
  adapter: SpeechAdapter;
}): Promise<{ ok: true; audio: Uint8Array } | { ok: false; reason: SpeechDenial | 'adapter_failed' }> {
  const base = {
    actorId: input.actorId, consumerId: input.consumerId,
    profileId: input.profile.id, purpose: input.purpose
  };
  const decision = authorizeAgentSpeech(input);
  // Mandatory preflight audit; no raw text or private provider IDs in the audit record.
  await dependencies.audit({ ...base, action: 'voice.agent.authorize',
    result: decision.allowed ? 'allowed' : 'denied',
    ...(!decision.allowed ? { reason: decision.reason } : {}) });
  if (!decision.allowed) return { ok: false, reason: decision.reason };
  if (dependencies.adapter.backend !== decision.backend || !input.binding) {
    await dependencies.audit({ ...base, action: 'voice.agent.failed', result: 'failed', reason: 'provider_unavailable' });
    return { ok: false, reason: 'provider_unavailable' };
  }
  try {
    const audio = await dependencies.adapter.synthesize({
      privateVoiceRef: input.binding.privateVoiceRef,
      text: input.text, locale: input.locale, style: input.style
    });
    if (!(audio instanceof Uint8Array) || audio.byteLength === 0) throw new Error('empty_audio');
    await dependencies.audit({ ...base, action: 'voice.agent.synthesized', result: 'success' });
    return { ok: true, audio };
  } catch {
    await dependencies.audit({ ...base, action: 'voice.agent.failed', result: 'failed', reason: 'adapter_failed' });
    return { ok: false, reason: 'adapter_failed' };
  }
}
