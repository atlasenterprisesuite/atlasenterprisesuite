import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceStudioPage } from '../../apps/web/src/modules/voice/VoiceStudioPage';

class FakeRecognition {
  continuous = false;
  interimResults = false;
  lang = 'en-US';
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult = null;

  start() { this.onstart?.(); }
  stop() { this.onend?.(); }
  abort() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.SpeechRecognition;
});

describe('ATLAS functional avatar', () => {
  it('renders the ATLAS particle avatar as the live microphone control', () => {
    window.SpeechRecognition = FakeRecognition as never;
    vi.stubGlobal('speechSynthesis', { speaking: false, cancel: vi.fn(), speak: vi.fn() });

    render(<MemoryRouter><VoiceStudioPage /></MemoryRouter>);

    const avatar = screen.getByRole('button', { name: 'Start speaking with ATLAS' });
    expect(avatar).toHaveAttribute('data-state', 'idle');
    expect(document.querySelector('img[src="/atlas-avatar-particle.svg"]')).toBeTruthy();

    fireEvent.click(avatar);

    const stopAvatar = screen.getByRole('button', { name: 'Stop listening with ATLAS' });
    expect(stopAvatar).toHaveAttribute('data-state', 'listening');
    expect(screen.getByText('ATLAS // LISTENING')).toBeInTheDocument();

    fireEvent.click(stopAvatar);

    expect(screen.getByRole('button', { name: 'Start speaking with ATLAS' })).toHaveAttribute('data-state', 'cancelled');
    expect(screen.getByText('ATLAS // CANCELLED')).toBeInTheDocument();
  });

  it('keeps the real capability boundary visible when browser recognition is unavailable', () => {
    render(<MemoryRouter><VoiceStudioPage /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'Start speaking with ATLAS' })).toBeDisabled();
    expect(screen.getByText(/browser does not expose SpeechRecognition/i)).toBeInTheDocument();
    expect(screen.getByText('Requires ATLAS iOS app')).toBeInTheDocument();
  });
});
