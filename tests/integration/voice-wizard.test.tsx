import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PersonalVoiceWizard } from '../../apps/web/src/modules/voice/PersonalVoiceWizard';
import type { MicrophoneAdapter } from '../../apps/web/src/modules/voice/browserMicrophone';

class DeniedMicrophone implements MicrophoneAdapter {
  async requestPermission() { return 'denied' as const; }
  async start() {}
  async stop() {
    return {
      blob: new Blob(['audio']),
      stats: { peak: 0.7, rms: 0.18, silenceRatio: 0.12, noiseFloor: 0.015, volumeStdDev: 0.04 }
    };
  }
}

class GoodMicrophone implements MicrophoneAdapter {
  async requestPermission() { return 'granted' as const; }
  async start() {}
  async stop() {
    return {
      blob: new Blob(['audio']),
      stats: { peak: 0.7, rms: 0.18, silenceRatio: 0.12, noiseFloor: 0.015, volumeStdDev: 0.04 }
    };
  }
}

beforeEach(() => window.localStorage.clear());

describe('ATLAS Personal Voice wizard', () => {
  it('requires explicit ownership consent before continuing', () => {
    render(<MemoryRouter><PersonalVoiceWizard initialStep="setup" /></MemoryRouter>);
    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /I own or am authorized/i }));
    expect(continueButton).toBeEnabled();
  });

  it('reports denied microphone permission', async () => {
    render(<MemoryRouter><PersonalVoiceWizard initialStep="sound-check" microphone={new DeniedMicrophone()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Check microphone' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Microphone access is required/i);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('accepts a high-quality in-session challenge sample', async () => {
    render(<MemoryRouter><PersonalVoiceWizard initialStep="record" microphone={new GoodMicrophone()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findByText('Accepted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeEnabled();
  });

  it('does not enable generation without a real provider', async () => {
    render(<MemoryRouter><PersonalVoiceWizard initialStep="generate" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh provider' }));
    expect(await screen.findByText(/Voice generation provider not configured/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Voice' })).toBeDisabled();
  });
});
