import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = () => readFileSync('supabase/functions/atlas-voice-native-verification/index.ts', 'utf8');

describe('ATLAS Apple native verification Edge contract', () => {
  it('derives user and active organization from the authenticated session', () => {
    const text = source();
    expect(text).toContain('/auth/v1/user');
    expect(text).toContain('/rest/v1/organization_members');
    expect(text).toContain('voice.apple.use');
    expect(text).not.toContain('body.org_id');
  });

  it('accepts metadata-only Apple verification evidence and rejects audio-like fields', () => {
    const text = source();
    expect(text).toContain('atlas_voice_native_verifications');
    expect(text).toContain('local_playback_verified');
    expect(text).toContain('personal_voice_count');
    expect(text).toContain('audio_bytes');
    expect(text).toContain('raw_audio');
    expect(text).toContain('evidence_contains_audio');
  });

  it('never promotes simulator or CI evidence to physical-device verification', () => {
    const text = source();
    expect(text).toContain("verification_state:'device_reported'");
    expect(text).not.toContain("verification_state:'verified_on_supported_device'");
  });
});
