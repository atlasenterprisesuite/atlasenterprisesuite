import React from 'react';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElevenLabsNarration } from '../../apps/web/src/modules/voice/ElevenLabsNarration';
import { atlasVoiceApi, AtlasVoiceApi } from '../../apps/web/src/modules/voice/voiceApi';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ElevenLabs narration flow', () => {
  it('disables generation when the provider is unconfigured', async () => {
    vi.spyOn(atlasVoiceApi, 'elevenLabsStatus').mockResolvedValue({ state: 'provider_not_configured', configured: false, synthesis_verified: false });
    render(<ElevenLabsNarration />);
    await screen.findByText('ElevenLabs requires a server API key.');
    expect(screen.getByRole('button', { name: 'Generate MP3' })).toBeDisabled();
  });
  it('generates, plays and downloads audio only after successful synthesis', async () => {
    vi.spyOn(atlasVoiceApi, 'elevenLabsStatus').mockResolvedValue({ state: 'access_verified', configured: true, synthesis_verified: false });
    const generate = vi.spyOn(atlasVoiceApi, 'synthesizeElevenLabs').mockResolvedValue(new Blob(['audio'], { type: 'audio/mpeg' }));
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:generated') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const { unmount } = render(<ElevenLabsNarration />);
    const button = screen.getByRole('button', { name: 'Generate MP3' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    const link = await screen.findByRole('link', { name: 'Download MP3' });
    expect(link).toHaveAttribute('href', 'blob:generated');
    expect(screen.getByLabelText('Generated narration')).toHaveAttribute('src', 'blob:generated');
    expect(generate).toHaveBeenCalledWith('The first move sets everything in motion.', expect.any(AbortSignal));
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:generated');
  });
  it('shows provider errors without a fake audio download', async () => {
    vi.spyOn(atlasVoiceApi, 'elevenLabsStatus').mockResolvedValue({ state: 'access_verified', configured: true, synthesis_verified: false });
    vi.spyOn(atlasVoiceApi, 'synthesizeElevenLabs').mockRejectedValue(new Error('rate_limited'));
    render(<ElevenLabsNarration />);
    const button = screen.getByRole('button', { name: 'Generate MP3' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('rate_limited');
    expect(screen.queryByRole('link', { name: 'Download MP3' })).toBeNull();
  });
  it('sends active organization context and explicitly selects ElevenLabs', async () => {
    const transport = vi.fn().mockResolvedValue(new Response('audio', { headers: { 'content-type': 'audio/mpeg' } }));
    const api = new AtlasVoiceApi({ transport, getContext: async () => ({ userId: 'user', orgId: 'org' }) });
    await api.synthesizeElevenLabs('Hello');
    expect(transport).toHaveBeenCalledWith('/functions/v1/atlas-voice-provider?api=speech&provider=elevenlabs', expect.objectContaining({ headers: { 'content-type': 'application/json', 'x-atlas-org-id': 'org' }, body: JSON.stringify({ text: 'Hello' }) }));
  });
});
