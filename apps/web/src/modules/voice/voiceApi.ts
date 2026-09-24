import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type VoiceApiContext = {
  userId: string;
  orgId: string;
};

export type VoiceApiTransport = (path: string, init?: RequestInit) => Promise<Response>;

export type VoiceProfileRow = {
  id: string;
  org_id: string;
  owner_user_id: string;
  name: string;
  language: string;
  provider_kind: 'atlas' | 'apple_personal_voice';
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type VoiceSessionRow = {
  id: string;
  org_id: string;
  profile_id: string;
  owner_user_id: string;
  status: string;
  current_step: string;
  accepted_sample_count: number;
  challenge_verified: boolean;
  created_at?: string;
  updated_at?: string;
};

export type VoiceSampleRow = {
  id: string;
  profile_id: string;
  session_id: string;
  phrase_id: string;
  attempt: number;
  storage_path: string | null;
  status: 'accepted' | 'needs_retry' | 'rejected' | 'missing';
  audio_stats: JsonRecord;
  assessment: JsonRecord;
  created_at?: string;
};

export type VoiceConsentRow = {
  id: string;
  profile_id: string;
  consent_version: string;
  scope: JsonRecord;
  accepted_at: string;
  revoked_at: string | null;
};

type JsonRecord = Record<string, unknown>;

export type VoiceProviderStatus = {
  ok: boolean;
  provider: 'openai_custom_voice';
  state: string;
  configured?: boolean;
  readable?: boolean;
  writable?: boolean;
  capabilities?: JsonRecord;
};

export type VoiceProviderConsentPhrase = {
  language: string;
  text: string;
};

export type VoiceProviderCreateResult = {
  ok: boolean;
  state: string;
  consent_id?: string;
  voice_id?: string;
};

type VoiceApiDependencies = {
  transport?: VoiceApiTransport;
  getContext?: () => Promise<VoiceApiContext>;
  randomUUID?: () => string;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    const message = record.message || record.error_description || record.error || body || `Request failed (${response.status})`;
    throw new Error(String(message));
  }
  return body as T;
}

function firstRow<T>(rows: T[] | T): T {
  if (Array.isArray(rows)) {
    if (!rows[0]) throw new Error('voice_persistence_empty_response');
    return rows[0];
  }
  return rows;
}

async function defaultContext(transport: VoiceApiTransport): Promise<VoiceApiContext> {
  const [organization, userResponse] = await Promise.all([
    getActiveAtlasOrganization(),
    transport('/auth/v1/user', { method: 'GET' })
  ]);
  const user = await parseResponse<{ id?: string }>(userResponse);
  if (!user?.id) throw new Error('voice_user_identity_unavailable');
  return { userId: String(user.id), orgId: organization.id };
}

function audioExtension(mimeType: string) {
  const normalized = mimeType.toLowerCase().split(';')[0].trim();
  switch (normalized) {
    case 'audio/webm': return 'webm';
    case 'audio/mp4': return 'mp4';
    case 'audio/mpeg': return 'mp3';
    case 'audio/wav':
    case 'audio/x-wav': return 'wav';
    case 'audio/aac': return 'aac';
    case 'audio/ogg': return 'ogg';
    default: throw new Error('voice_audio_type_not_allowed');
  }
}

function postgrestHeaders() {
  return {
    Prefer: 'return=representation',
    'content-type': 'application/json'
  };
}


function normalizeConsentPhrases(value: unknown): VoiceProviderConsentPhrase[] {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  const candidates = Array.isArray(value)
    ? value
    : Array.isArray(source?.data)
      ? source?.data as unknown[]
      : Array.isArray(source?.phrases)
        ? source?.phrases as unknown[]
        : source
          ? Object.entries(source).map(([language, text]) => ({ language, text }))
          : [];

  return candidates.flatMap((item) => {
    if (typeof item === 'string') return [{ language: '', text: item }];
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const language = String(record.language || record.locale || record.lang || '').trim();
    const text = String(record.text || record.phrase || record.consent_phrase || '').trim();
    return text ? [{ language, text }] : [];
  });
}

export class AtlasVoiceApi {
  private readonly transport: VoiceApiTransport;
  private readonly getContext: () => Promise<VoiceApiContext>;
  private readonly randomUUID: () => string;

  constructor(dependencies: VoiceApiDependencies = {}) {
    this.transport = dependencies.transport || authorizedAtlasFetch;
    this.getContext = dependencies.getContext || (() => defaultContext(this.transport));
    this.randomUUID = dependencies.randomUUID || (() => crypto.randomUUID());
  }

  async listProfiles(): Promise<VoiceProfileRow[]> {
    const { orgId, userId } = await this.getContext();
    const path =
      '/rest/v1/atlas_voice_profiles'
      + `?org_id=${encodeURIComponent(`eq.${orgId}`)}`
      + `&owner_user_id=${encodeURIComponent(`eq.${userId}`)}`
      + '&select=id,org_id,owner_user_id,name,language,provider_kind,status,created_at,updated_at'
      + '&order=created_at.desc';
    const response = await this.transport(path, { method: 'GET' });
    return parseResponse<VoiceProfileRow[]>(response);
  }

  async createProfile(input: { name: string; language: string }): Promise<VoiceProfileRow> {
    const { orgId, userId } = await this.getContext();
    const response = await this.transport(
      '/rest/v1/atlas_voice_profiles?select=id,org_id,owner_user_id,name,language,provider_kind,status,created_at,updated_at',
      {
        method: 'POST',
        headers: postgrestHeaders(),
        body: JSON.stringify({
          org_id: orgId,
          owner_user_id: userId,
          name: input.name.trim() || 'My ATLAS Voice',
          language: input.language,
          provider_kind: 'atlas',
          status: 'draft'
        })
      }
    );
    return firstRow(await parseResponse<VoiceProfileRow[]>(response));
  }

  async createSession(profileId: string): Promise<VoiceSessionRow> {
    const { orgId, userId } = await this.getContext();
    const response = await this.transport(
      '/rest/v1/atlas_voice_recording_sessions?select=id,org_id,profile_id,owner_user_id,status,current_step,accepted_sample_count,challenge_verified,created_at,updated_at',
      {
        method: 'POST',
        headers: postgrestHeaders(),
        body: JSON.stringify({
          org_id: orgId,
          profile_id: profileId,
          owner_user_id: userId,
          status: 'draft',
          current_step: 'setup'
        })
      }
    );
    return firstRow(await parseResponse<VoiceSessionRow[]>(response));
  }

  async listSessions(profileId: string): Promise<VoiceSessionRow[]> {
    const { orgId, userId } = await this.getContext();
    const path =
      '/rest/v1/atlas_voice_recording_sessions'
      + `?org_id=${encodeURIComponent(`eq.${orgId}`)}`
      + `&owner_user_id=${encodeURIComponent(`eq.${userId}`)}`
      + `&profile_id=${encodeURIComponent(`eq.${profileId}`)}`
      + '&select=id,org_id,profile_id,owner_user_id,status,current_step,accepted_sample_count,challenge_verified,created_at,updated_at'
      + '&order=created_at.desc';
    return parseResponse<VoiceSessionRow[]>(await this.transport(path, { method: 'GET' }));
  }

  async updateSession(
    sessionId: string,
    patch: Partial<Pick<VoiceSessionRow, 'status' | 'current_step' | 'accepted_sample_count' | 'challenge_verified'>>
  ): Promise<VoiceSessionRow> {
    const response = await this.transport(
      `/rest/v1/atlas_voice_recording_sessions?id=${encodeURIComponent(`eq.${sessionId}`)}&select=id,org_id,profile_id,owner_user_id,status,current_step,accepted_sample_count,challenge_verified,created_at,updated_at`,
      {
        method: 'PATCH',
        headers: postgrestHeaders(),
        body: JSON.stringify(patch)
      }
    );
    return firstRow(await parseResponse<VoiceSessionRow[]>(response));
  }


  async listSamples(sessionId: string): Promise<VoiceSampleRow[]> {
    const { orgId, userId } = await this.getContext();
    const path =
      '/rest/v1/atlas_voice_samples'
      + `?org_id=${encodeURIComponent(`eq.${orgId}`)}`
      + `&owner_user_id=${encodeURIComponent(`eq.${userId}`)}`
      + `&session_id=${encodeURIComponent(`eq.${sessionId}`)}`
      + '&select=id,profile_id,session_id,phrase_id,attempt,storage_path,status,audio_stats,assessment,created_at'
      + '&order=created_at.asc';
    return parseResponse<VoiceSampleRow[]>(await this.transport(path, { method: 'GET' }));
  }

  async listConsents(profileId: string): Promise<VoiceConsentRow[]> {
    const { orgId, userId } = await this.getContext();
    const path =
      '/rest/v1/atlas_voice_consents'
      + `?org_id=${encodeURIComponent(`eq.${orgId}`)}`
      + `&owner_user_id=${encodeURIComponent(`eq.${userId}`)}`
      + `&profile_id=${encodeURIComponent(`eq.${profileId}`)}`
      + '&revoked_at=is.null'
      + '&select=id,profile_id,consent_version,scope,accepted_at,revoked_at'
      + '&order=accepted_at.desc&limit=1';
    return parseResponse<VoiceConsentRow[]>(await this.transport(path, { method: 'GET' }));
  }

  async saveConsent(input: { profileId: string; consentVersion: string; scope?: JsonRecord }) {
    const { orgId, userId } = await this.getContext();
    const response = await this.transport(
      '/rest/v1/atlas_voice_consents?select=id,profile_id,consent_version,scope,accepted_at,revoked_at',
      {
        method: 'POST',
        headers: postgrestHeaders(),
        body: JSON.stringify({
          org_id: orgId,
          profile_id: input.profileId,
          owner_user_id: userId,
          consent_version: input.consentVersion,
          scope: input.scope || {
            purpose: 'personal_voice_creation',
            owner_attestation: true,
            provider_generation_authorized: false
          }
        })
      }
    );
    return firstRow(await parseResponse<Record<string, unknown>[]>(response));
  }

  async saveAcceptedSample(input: {
    profileId: string;
    sessionId: string;
    phraseId: string;
    attempt: number;
    blob: Blob;
    durationMs?: number;
    stats: JsonRecord;
    assessment: JsonRecord;
  }) {
    const { orgId, userId } = await this.getContext();
    const sampleId = this.randomUUID();
    const extension = audioExtension(input.blob.type || 'audio/webm');
    const storagePath = `${userId}/${input.profileId}/${input.sessionId}/${sampleId}.${extension}`;
    const storageEndpoint = `/storage/v1/object/atlas-voice-samples/${storagePath}`;

    const uploadResponse = await this.transport(storageEndpoint, {
      method: 'POST',
      headers: {
        'content-type': input.blob.type || 'audio/webm',
        'x-upsert': 'false',
        'cache-control': 'no-store'
      },
      body: input.blob
    });
    await parseResponse(uploadResponse);

    try {
      const metadataResponse = await this.transport(
        '/rest/v1/atlas_voice_samples?select=id,profile_id,session_id,phrase_id,attempt,storage_path,status,created_at',
        {
          method: 'POST',
          headers: postgrestHeaders(),
          body: JSON.stringify({
            id: sampleId,
            org_id: orgId,
            owner_user_id: userId,
            profile_id: input.profileId,
            session_id: input.sessionId,
            phrase_id: input.phraseId,
            attempt: input.attempt,
            storage_path: storagePath,
            mime_type: input.blob.type || 'audio/webm',
            duration_ms: input.durationMs ?? null,
            byte_size: input.blob.size,
            status: 'accepted',
            audio_stats: input.stats,
            assessment: input.assessment
          })
        }
      );
      return firstRow(await parseResponse<Record<string, unknown>[]>(metadataResponse));
    } catch (error) {
      try {
        await this.transport('/storage/v1/object/atlas-voice-samples', {
          method: 'DELETE',
          body: JSON.stringify({ prefixes: [storagePath] })
        });
      } catch {
        // Best-effort cleanup only; the original persistence error is authoritative.
      }
      throw error;
    }
  }

  async providerStatus(): Promise<VoiceProviderStatus> {
    return parseResponse<VoiceProviderStatus>(
      await this.transport('/functions/v1/atlas-voice-provider?api=status', { method: 'GET' })
    );
  }

  async providerConsentPhrases(): Promise<VoiceProviderConsentPhrase[]> {
    const body = await parseResponse<{ ok: boolean; phrases?: unknown }>(
      await this.transport('/functions/v1/atlas-voice-provider?api=consent-phrases', { method: 'GET' })
    );
    return normalizeConsentPhrases(body.phrases);
  }

  async createProviderConsent(profileId: string, sampleId: string): Promise<VoiceProviderCreateResult> {
    return parseResponse<VoiceProviderCreateResult>(
      await this.transport('/functions/v1/atlas-voice-provider?api=create-consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, sample_id: sampleId })
      })
    );
  }

  async createProviderVoice(profileId: string, sampleId: string): Promise<VoiceProviderCreateResult> {
    return parseResponse<VoiceProviderCreateResult>(
      await this.transport('/functions/v1/atlas-voice-provider?api=create-voice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, sample_id: sampleId })
      })
    );
  }

  async synthesizeProviderVoice(profileId: string, text: string, format = 'mp3'): Promise<Blob> {
    const response = await this.transport('/functions/v1/atlas-voice-provider?api=speech', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId, text, format })
    });
    if (!response.ok) await parseResponse(response);
    return response.blob();
  }

  async appendAuditEvent(profileId: string, eventType: string, metadata: JsonRecord = {}) {
    const { orgId } = await this.getContext();
    const response = await this.transport('/rest/v1/atlas_voice_audit_events?select=id,event_type,created_at', {
      method: 'POST',
      headers: postgrestHeaders(),
      body: JSON.stringify({
        org_id: orgId,
        profile_id: profileId,
        event_type: eventType,
        metadata
      })
    });
    return firstRow(await parseResponse<Record<string, unknown>[]>(response));
  }
}

export const atlasVoiceApi = new AtlasVoiceApi();
