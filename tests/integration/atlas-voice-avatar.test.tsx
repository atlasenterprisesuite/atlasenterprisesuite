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
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
});

describe('ATLAS approved Voice production experience', () => {
  it('renders the approved ATLAS avatar and state-driven conversation surface', () => {
    window.SpeechRecognition = FakeRecognition as never;
    vi.stubGlobal('speechSynthesis', { speaking: false, cancel: vi.fn(), speak: vi.fn() });

    render(<MemoryRouter><VoiceStudioPage /></MemoryRouter>);

    const avatar = screen.getByRole('button', { name: 'Start speaking with ATLAS' });
    expect(avatar).toHaveAttribute('data-state', 'idle');
    expect(document.querySelector('img[src="/assets/atlas-voice-avatar-approved.webp"]')).toBeTruthy();
    expect(document.querySelector('img[src="/atlas-avatar-particle.svg"]')).toBeFalsy();
    expect(screen.getByRole('heading', { name: 'Talk to ATLAS' })).toBeInTheDocument();
    expect(screen.getByText('Private voice turn')).toBeInTheDocument();
    expect(screen.getByText('Listening')).toBeInTheDocument();
    expect(screen.getByText('Understanding')).toBeInTheDocument();
    expect(screen.getByText('Thinking')).toBeInTheDocument();
    expect(screen.getByText('Speaking')).toBeInTheDocument();
    expect(screen.getByText('Mic ready')).toBeInTheDocument();
    expect(screen.getByText('You said')).toBeInTheDocument();
    expect(screen.getByText('ATLAS replied')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start voice' })).toBeEnabled();
    expect(screen.getByText('Voice diagnostics')).toBeInTheDocument();

    fireEvent.click(avatar);

    const stopAvatar = screen.getByRole('button', { name: 'Stop listening with ATLAS' });
    expect(stopAvatar).toHaveAttribute('data-state', 'listening');
    expect(screen.getByText('ATLAS // LISTENING')).toBeInTheDocument();

    fireEvent.click(stopAvatar);

    expect(screen.getByRole('button', { name: 'Start speaking with ATLAS' })).toHaveAttribute('data-state', 'cancelled');
    expect(screen.getByText('ATLAS // CANCELLED')).toBeInTheDocument();
  });

  it('keeps readiness truthful when browser recognition is unavailable', () => {
    render(<MemoryRouter><VoiceStudioPage /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'Start speaking with ATLAS' })).toBeDisabled();
    expect(screen.getByText('Mic unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Mic ready')).not.toBeInTheDocument();
    expect(screen.getByText(/Microphone transcription is unavailable in this browser/i)).toBeInTheDocument();
    expect(screen.getByText(/Requires ATLAS iOS app/i)).toBeInTheDocument();
  });

  it('surfaces offline state and never presents AI as verified while offline', () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    window.SpeechRecognition = FakeRecognition as never;

    render(<MemoryRouter><VoiceStudioPage /></MemoryRouter>);

    expect(screen.getAllByText('Offline').length).toBeGreaterThan(0);
    expect(screen.queryByText('AI verified')).not.toBeInTheDocument();
  });
});
