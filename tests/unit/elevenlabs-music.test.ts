import { describe, expect, it, vi } from 'vitest';
import {
  elevenLabsMusic,
  elevenLabsMusicGenerate,
  elevenLabsMusicReadiness
} from '../../supabase/functions/atlas-creator/_shared/elevenlabs_music.mjs';

describe('ATLAS ElevenLabs Music adapter', () => {
  it('fails closed when the provider secret is absent', async () => {
    const readiness = await elevenLabsMusicReadiness('', vi.fn());
    expect(readiness.ready).toBe(false);
    expect(readiness.connectionState).toBe('unconfigured');
  });

  it('marks music executable only when the configured account exposes Music v2', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json([
      { model_id: 'eleven_multilingual_v2' },
      { model_id: 'music_v2' }
    ]));
    const readiness = await elevenLabsMusicReadiness('test-key', fetcher);
    expect(readiness.ready).toBe(true);
    expect(readiness.engineId).toBe('elevenlabs-music-v2');
    expect(readiness.mediaKinds).toEqual(['music']);
    expect(fetcher.mock.calls[0][0]).toContain('/v1/models');
  });

  it('generates a C2PA-signed instrumental through the documented Music v2 endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([73, 68, 51]), {
      status: 200,
      headers: { 'content-type': 'audio/mpeg', 'song-id': 'song-1' }
    }));
    const response = await elevenLabsMusicGenerate('test-key', {
      prompt: 'Wondering cinematic ambient score',
      durationSeconds: 60,
      instrumental: true
    }, fetcher);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toContain('/v1/music?output_format=mp3_48000_192');
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('test-key');
    expect(JSON.parse(String(init.body))).toEqual({
      prompt: 'Wondering cinematic ambient score',
      music_length_ms: 60000,
      model_id: elevenLabsMusic.model,
      force_instrumental: true,
      sign_with_c2pa: true
    });
    expect(response.headers.get('x-atlas-ai-disclosure')).toBe('AI-generated music');
    expect(response.headers.get('x-atlas-song-id')).toBe('song-1');
  });
});
