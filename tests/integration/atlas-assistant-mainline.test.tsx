import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getActiveAtlasOrganization: vi.fn(),
  getAssistantStatus: vi.fn(),
  sendAssistantMessage: vi.fn(),
  startMicrophone: vi.fn(),
  stopMicrophone: vi.fn(),
  stopSpeech: vi.fn(),
  speak: vi.fn(),
  setSpeechEnabled: vi.fn()
}));

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  ATLAS_SESSION_EVENT: 'atlas-session-changed',
  getActiveAtlasOrganization: mocks.getActiveAtlasOrganization
}));

vi.mock('../../apps/web/src/assistant/client', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/assistant/client')>('../../apps/web/src/assistant/client');
  return {
    ...actual,
    getAssistantStatus: mocks.getAssistantStatus,
    sendAssistantMessage: mocks.sendAssistantMessage
  };
});

vi.mock('../../apps/web/src/assistant/useAssistantVoice', () => ({
  useAssistantVoice: () => ({
    microphoneCapability: 'permission-required',
    microphoneActive: false,
    speechCapability: 'unavailable',
    speechEnabled: false,
    setSpeechEnabled: mocks.setSpeechEnabled,
    startMicrophone: mocks.startMicrophone,
    stopMicrophone: mocks.stopMicrophone,
    stopSpeech: mocks.stopSpeech,
    speak: mocks.speak
  })
}));

import { AtlasAssistant } from '../../apps/web/src/components/assistant/AtlasAssistant';

describe('ATLAS Assistant on current mainline architecture', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    mocks.getActiveAtlasOrganization.mockReset().mockResolvedValue({ id: 'org-1', role: 'owner' });
    mocks.getAssistantStatus.mockReset().mockResolvedValue({
      ok: true,
      authenticated: true,
      provider: 'openai',
      provider_state: 'not_configured',
      model: null,
      storage_state: 'configured',
      organization: 'org-1',
      role: 'owner',
      capabilities: ['generation', 'reasoning'],
      providers: [
        { id: 'openai', state: 'configuration-required', configured: false, verified: false, model: null, capabilities: ['generation'], profiles: ['balanced'], error: 'provider_not_configured' },
        { id: 'gemini', state: 'verified', configured: true, verified: true, model: 'gemini-live', capabilities: ['generation', 'reasoning'], profiles: ['balanced'], error: null }
      ]
    });
    mocks.sendAssistantMessage.mockReset();
    mocks.startMicrophone.mockReset();
    mocks.stopMicrophone.mockReset();
    mocks.stopSpeech.mockReset();
    mocks.speak.mockReset();
    mocks.setSpeechEnabled.mockReset();
  });

  it('shows the authenticated launcher when any governed provider is verified', async () => {
    render(<MemoryRouter initialEntries={['/hospitality']}><AtlasAssistant /></MemoryRouter>);
    const launcher = await screen.findByRole('button', { name: /Open ATLAS Assistant, Intelligence gemini ready/i });
    expect(launcher).toBeInTheDocument();
    expect(mocks.startMicrophone).not.toHaveBeenCalled();

    fireEvent.click(launcher);
    expect(await screen.findByText('ATLAS Assistant is ready. How can I help in this workspace?')).toBeInTheDocument();
    expect(screen.getByText(/Hospitality/)).toBeInTheDocument();
  });

  it('stays hidden without an active organization', async () => {
    mocks.getActiveAtlasOrganization.mockRejectedValue(new Error('no_active_organization'));
    render(<MemoryRouter><AtlasAssistant /></MemoryRouter>);
    await waitFor(() => expect(mocks.getActiveAtlasOrganization).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Open ATLAS Assistant/ })).not.toBeInTheDocument();
  });

  it('does not claim text readiness when no provider is verified', async () => {
    mocks.getAssistantStatus.mockResolvedValue({
      ok: true,
      authenticated: true,
      provider: 'openai',
      provider_state: 'not_configured',
      model: null,
      storage_state: 'configured',
      organization: 'org-1',
      role: 'owner',
      capabilities: ['generation', 'reasoning'],
      providers: [
        { id: 'openai', state: 'configuration-required', configured: false, verified: false, model: null, capabilities: [], profiles: [], error: 'provider_not_configured' },
        { id: 'gemini', state: 'configuration-required', configured: false, verified: false, model: null, capabilities: [], profiles: [], error: 'provider_not_configured' },
        { id: 'codex-sovereign', state: 'configuration-required', configured: false, verified: false, model: null, capabilities: [], profiles: [], error: 'provider_not_configured' }
      ]
    });

    render(<MemoryRouter><AtlasAssistant /></MemoryRouter>);
    const launcher = await screen.findByRole('button', { name: /Intelligence configuration required/i });
    fireEvent.click(launcher);
    expect(screen.getByLabelText('Message ATLAS Assistant')).toBeDisabled();
    expect(screen.queryByText('ATLAS Assistant is ready. How can I help in this workspace?')).not.toBeInTheDocument();
  });
});
