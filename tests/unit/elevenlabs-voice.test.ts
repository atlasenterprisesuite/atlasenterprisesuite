import { describe, expect, it, vi } from 'vitest';
import { elevenLabsAccess, elevenLabsSpeech } from '../../supabase/functions/atlas-voice-provider/elevenlabs.mjs';

describe('ElevenLabs voice adapter', () => {
  it('fails closed without a secret and never calls the provider', async () => {
    const fetcher = vi.fn();
    expect(await elevenLabsAccess('', fetcher)).toMatchObject({ configured: false, state: 'provider_not_configured' });
    await expect(elevenLabsSpeech('', 'Hello', fetcher)).rejects.toMatchObject({ message: 'provider_not_configured' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('checks voice access without charging for a speech probe', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ voice_id: 'JBFqnCBsd6RMkjVDRZzb' })));
    expect(await elevenLabsAccess('test-key', fetcher)).toMatchObject({ state: 'access_verified', synthesis_verified: false });
    expect(fetcher.mock.calls[0][0]).toBe('https://api.elevenlabs.io/v1/voices/JBFqnCBsd6RMkjVDRZzb');
    expect(fetcher.mock.calls[0][1].method).toBe('GET');
  });
  it.each([401, 403, 429, 500])('does not report access on provider failure %s', async (status) => {
    const result = await elevenLabsAccess('test-key', vi.fn().mockResolvedValue(new Response('{}', { status })));
    expect(result.state).not.toBe('access_verified');
  });
  it.each(['', ' '.repeat(5), 'x'.repeat(1001), 123])('rejects invalid input before spending', async (text) => {
    const fetcher = vi.fn();
    await expect(elevenLabsSpeech('test-key', text, fetcher)).rejects.toMatchObject({ message: 'invalid_input', status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses the approved voice/model, returns MP3, and discloses synthetic audio', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([73, 68, 51]), { headers: { 'content-type': 'audio/mpeg' } }));
    const response = await elevenLabsSpeech('test-key', 'The first move sets everything in motion.', fetcher);
    expect(fetcher.mock.calls[0][0]).toContain('/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ text: 'The first move sets everything in motion.', model_id: 'eleven_multilingual_v2' });
    expect(response.headers.get('x-atlas-provider')).toBe('elevenlabs');
    expect(response.headers.get('x-atlas-ai-disclosure')).toBe('AI-generated voice');
    expect((await response.arrayBuffer()).byteLength).toBe(3);
  });
  it('does not return an error body as playable audio or expose provider secrets', async () => {
    await expect(elevenLabsSpeech('test-key', 'Hello', vi.fn().mockResolvedValue(new Response('test-key', { status: 429 })))).rejects.toMatchObject({ message: 'rate_limited', status: 429 });
    await expect(elevenLabsSpeech('test-key', 'Hello', vi.fn().mockResolvedValue(new Response('{}', { headers: { 'content-type': 'application/json' } })))).rejects.toMatchObject({ message: 'provider_invalid_response' });
  });
});
