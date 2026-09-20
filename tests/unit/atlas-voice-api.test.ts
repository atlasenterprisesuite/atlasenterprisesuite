import { describe, expect, it } from 'vitest';
import { AtlasVoiceApi, type VoiceApiContext, type VoiceApiTransport } from '../../apps/web/src/modules/voice/voiceApi';

const context: VoiceApiContext = {
  userId: '11111111-1111-4111-8111-111111111111',
  orgId: '22222222-2222-4222-8222-222222222222'
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('ATLAS Voice Supabase API adapter', () => {
  it('creates a self-owned draft profile in the active organization', async () => {
    const calls: Array<{ path: string; init?: RequestInit }> = [];
    const transport: VoiceApiTransport = async (path, init) => {
      calls.push({ path, init });
      return jsonResponse([{ id: '33333333-3333-4333-8333-333333333333', status: 'draft' }], 201);
    };

    const api = new AtlasVoiceApi({
      transport,
      getContext: async () => context,
      randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    });

    const profile = await api.createProfile({ name: 'My Voice', language: 'es-US' });

    expect(profile.id).toBe('33333333-3333-4333-8333-333333333333');
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toContain('/rest/v1/atlas_voice_profiles?select=');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      org_id: context.orgId,
      owner_user_id: context.userId,
      name: 'My Voice',
      language: 'es-US',
      provider_kind: 'atlas',
      status: 'draft'
    });
  });

  it('lists only the current owners profiles inside the active organization', async () => {
    const paths: string[] = [];
    const transport: VoiceApiTransport = async (path) => {
      paths.push(path);
      return jsonResponse([]);
    };
    const api = new AtlasVoiceApi({ transport, getContext: async () => context });

    await api.listProfiles();

    expect(paths[0]).toContain('org_id=eq.22222222-2222-4222-8222-222222222222');
    expect(paths[0]).toContain('owner_user_id=eq.11111111-1111-4111-8111-111111111111');
  });

  it('uploads accepted audio to the canonical private Storage path before persisting metadata', async () => {
    const calls: Array<{ path: string; init?: RequestInit }> = [];
    const transport: VoiceApiTransport = async (path, init) => {
      calls.push({ path, init });
      if (path.startsWith('/storage/v1/object/atlas-voice-samples/')) {
        return jsonResponse({ Key: 'ok' }, 200);
      }
      return jsonResponse([{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'accepted' }], 201);
    };

    const api = new AtlasVoiceApi({
      transport,
      getContext: async () => context,
      randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    });

    const blob = new Blob(['voice'], { type: 'audio/webm' });
    await api.saveAcceptedSample({
      profileId: '33333333-3333-4333-8333-333333333333',
      sessionId: '44444444-4444-4444-8444-444444444444',
      phraseId: 'challenge',
      attempt: 1,
      blob,
      stats: { peak: 0.7, rms: 0.18, silenceRatio: 0.1, noiseFloor: 0.01, volumeStdDev: 0.03 },
      assessment: { status: 'accepted', reasons: [] }
    });

    const expectedPath = [
      context.userId,
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webm'
    ].join('/');

    expect(calls[0].path).toBe('/storage/v1/object/atlas-voice-samples/' + expectedPath);
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.body).toBe(blob);
    expect(new Headers(calls[0].init?.headers).get('content-type')).toBe('audio/webm');

    expect(calls[1].path).toContain('/rest/v1/atlas_voice_samples?select=');
    const metadata = JSON.parse(String(calls[1].init?.body));
    expect(metadata).toMatchObject({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      org_id: context.orgId,
      owner_user_id: context.userId,
      profile_id: '33333333-3333-4333-8333-333333333333',
      session_id: '44444444-4444-4444-8444-444444444444',
      phrase_id: 'challenge',
      storage_path: expectedPath,
      status: 'accepted'
    });
  });

  it('persists consent and resumable session progress without provider readiness claims', async () => {
    const calls: Array<{ path: string; init?: RequestInit }> = [];
    const transport: VoiceApiTransport = async (path, init) => {
      calls.push({ path, init });
      if (path.includes('atlas_voice_consents')) return jsonResponse([{ id: 'consent-1' }], 201);
      return jsonResponse([{ id: '44444444-4444-4444-8444-444444444444', current_step: 'review' }]);
    };
    const api = new AtlasVoiceApi({ transport, getContext: async () => context });

    await api.saveConsent({
      profileId: '33333333-3333-4333-8333-333333333333',
      consentVersion: 'personal-voice-v1'
    });
    await api.updateSession('44444444-4444-4444-8444-444444444444', {
      current_step: 'review',
      accepted_sample_count: 4,
      challenge_verified: true,
      status: 'reviewing'
    });

    expect(calls[0].path).toContain('/rest/v1/atlas_voice_consents?select=');
    expect(calls[1].path).toContain('/rest/v1/atlas_voice_recording_sessions?id=eq.44444444-4444-4444-8444-444444444444');
    expect(String(calls[0].init?.body)).not.toContain('provider_ref');
    expect(String(calls[1].init?.body)).not.toContain('provider');
  });
});
