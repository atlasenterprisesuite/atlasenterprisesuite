import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PersonalVoiceWizard, type PersonalVoicePersistence } from '../../apps/web/src/modules/voice/PersonalVoiceWizard';
import type { MicrophoneAdapter } from '../../apps/web/src/modules/voice/browserMicrophone';

class GoodMicrophone implements MicrophoneAdapter {
  async requestPermission() { return 'granted' as const; }
  async start() {}
  async stop() {
    return {
      blob: new Blob(['voice'], { type: 'audio/webm' }),
      stats: { peak: 0.7, rms: 0.18, silenceRatio: 0.12, noiseFloor: 0.015, volumeStdDev: 0.04 }
    };
  }
}

function persistence(): PersonalVoicePersistence {
  return {
    listProfiles: vi.fn(async () => []),
    createProfile: vi.fn(async () => ({
      id: '33333333-3333-4333-8333-333333333333',
      org_id: '22222222-2222-4222-8222-222222222222',
      owner_user_id: '11111111-1111-4111-8111-111111111111',
      name: 'Mi voz ATLAS',
      language: 'es-US',
      provider_kind: 'atlas' as const,
      status: 'draft'
    })),
    createSession: vi.fn(async () => ({
      id: '44444444-4444-4444-8444-444444444444',
      org_id: '22222222-2222-4222-8222-222222222222',
      profile_id: '33333333-3333-4333-8333-333333333333',
      owner_user_id: '11111111-1111-4111-8111-111111111111',
      status: 'draft',
      current_step: 'setup',
      accepted_sample_count: 0,
      challenge_verified: false
    })),
    listSessions: vi.fn(async () => []),
    updateSession: vi.fn(async (_id, patch) => ({
      id: '44444444-4444-4444-8444-444444444444',
      org_id: '22222222-2222-4222-8222-222222222222',
      profile_id: '33333333-3333-4333-8333-333333333333',
      owner_user_id: '11111111-1111-4111-8111-111111111111',
      status: String(patch.status || 'recording'),
      current_step: String(patch.current_step || 'record'),
      accepted_sample_count: Number(patch.accepted_sample_count || 0),
      challenge_verified: Boolean(patch.challenge_verified)
    })),
    saveConsent: vi.fn(async () => ({ id: 'consent-1' })),
    saveAcceptedSample: vi.fn(async () => ({ id: 'sample-1', status: 'accepted' })),
    appendAuditEvent: vi.fn(async () => ({ id: 'audit-1' }))
  };
}

describe('ATLAS Personal Voice persisted wizard', () => {
  it('creates a Supabase profile/session and consent record before leaving setup', async () => {
    const api = persistence();
    render(
      <MemoryRouter>
        <PersonalVoiceWizard initialStep="setup" api={api} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /soy propietario|I own/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar|Continue/i }));

    await waitFor(() => expect(api.createProfile).toHaveBeenCalledWith({
      name: 'Mi voz ATLAS',
      language: 'es-US'
    }));
    expect(api.createSession).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333');
    expect(api.saveConsent).toHaveBeenCalledWith(expect.objectContaining({
      profileId: '33333333-3333-4333-8333-333333333333',
      consentVersion: 'personal-voice-v1'
    }));
  });

  it('requires a measured sound check before guided recording', async () => {
    const api = persistence();
    render(
      <MemoryRouter>
        <PersonalVoiceWizard
          initialStep="sound-check"
          api={api}
          microphone={new GoodMicrophone()}
          initialProfileId="33333333-3333-4333-8333-333333333333"
          initialSessionId="44444444-4444-4444-8444-444444444444"
          initialConsentAccepted
        />
      </MemoryRouter>
    );

    const continueButton = screen.getByRole('button', { name: /Continuar|Continue/i });
    expect(continueButton).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Iniciar|Start/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Finalizar|Finish/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Finalizar|Finish/i }));
    await waitFor(() => expect(screen.getByText(/Calidad general|Overall quality/i).parentElement).toHaveTextContent(/Aprobada|Pass/i));
    expect(continueButton).toBeEnabled();
  });

  it('uploads an accepted ownership challenge and persists session progress', async () => {
    const api = persistence();
    render(
      <MemoryRouter>
        <PersonalVoiceWizard
          initialStep="record"
          api={api}
          microphone={new GoodMicrophone()}
          initialProfileId="33333333-3333-4333-8333-333333333333"
          initialSessionId="44444444-4444-4444-8444-444444444444"
          initialConsentAccepted
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Grabar|Record/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Detener|Stop/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Detener|Stop/i }));

    await waitFor(() => expect(api.saveAcceptedSample).toHaveBeenCalledWith(expect.objectContaining({
      profileId: '33333333-3333-4333-8333-333333333333',
      sessionId: '44444444-4444-4444-8444-444444444444',
      phraseId: 'challenge'
    })));
    expect(api.updateSession).toHaveBeenCalledWith(
      '44444444-4444-4444-8444-444444444444',
      expect.objectContaining({ challenge_verified: true, accepted_sample_count: 1 })
    );
  });

  it('keeps generation unavailable when no verified synthesis provider exists', async () => {
    render(
      <MemoryRouter>
        <PersonalVoiceWizard
          initialStep="generate"
          api={persistence()}
          initialProfileId="33333333-3333-4333-8333-333333333333"
          initialSessionId="44444444-4444-4444-8444-444444444444"
          initialConsentAccepted
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/proveedor de generación.*no configurado|generation provider.*not configured/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generar voz|Generate Voice/i })).toBeDisabled();
  });
});
