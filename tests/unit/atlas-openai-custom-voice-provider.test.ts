import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = () => readFileSync('supabase/functions/atlas-voice-provider/index.ts', 'utf8');
const readiness = () => readFileSync('supabase/functions/atlas-openai-readiness/index.ts', 'utf8');

describe('ATLAS OpenAI Custom Voice provider contract', () => {
  it('keeps all custom-voice API calls server-side and behind the existing secret', () => {
    const text = source();
    expect(text).toContain("Deno.env.get('OPENAI_API_KEY')");
    expect(text).toContain('https://api.openai.com/v1/audio/voice_consents');
    expect(text).toContain('https://api.openai.com/v1/audio/voices');
    expect(text).toContain('https://api.openai.com/v1/audio/speech');
    expect(text).not.toMatch(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/);
  });

  it('requires authenticated organization and Voice permissions', () => {
    const text = source();
    expect(text).toContain('/auth/v1/user');
    expect(text).toContain('/rest/v1/organization_members');
    expect(text).toContain('voice.personal.generate');
    expect(text).toContain('voice.personal.use');
  });

  it('probes Custom Voice read/write eligibility without creating a provider resource', () => {
    const text = readiness();
    expect(text).toContain('https://api.openai.com/v1/audio/consent_phrases');
    expect(text).toContain('https://api.openai.com/v1/audio/voice_consents');
    expect(text).toContain('custom_voice');
    expect(text).toContain('write_probe');
  });

  it('uses a custom voice id object for TTS and discloses AI-generated speech', () => {
    const text = source();
    expect(text).toContain("model: 'gpt-4o-mini-tts'");
    expect(text).toContain('voice: { id: profile.provider_ref }');
    expect(text).toContain('x-atlas-ai-voice');
  });
});
