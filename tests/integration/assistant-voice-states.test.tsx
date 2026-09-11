import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getActiveAtlasOrganization: vi.fn(),
  getAssistantStatus: vi.fn(),
  startMicrophone: vi.fn(),
  stopMicrophone: vi.fn(),
  speak: vi.fn(),
  setSpeechEnabled: vi.fn()
}));

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  ATLAS_SESSION_EVENT: 'atlas-session-changed',
  getActiveAtlasOrganization: mocks.getActiveAtlasOrganization
}));

vi.mock('../../apps/web/src/assistant/client', () => ({
  getAssistantStatus: mocks.getAssistantStatus,
  sendAssistantMessage: vi.fn()
}));

vi.mock('../../apps/web/src/assistant/useAssistantVoice', () => ({
  useAssistantVoice: () => ({
    microphoneCapability: 'permission-required',
    microphoneActive: false,
    speechCapability: 'unavailable',
    speechEnabled: false,
    setSpeechEnabled: mocks.setSpeechEnabled,
    startMicrophone: mocks.startMicrophone,
    stopMicrophone: mocks.stopMicrophone,
    speak: mocks.speak
  })
}));

import { AtlasAssistant } from '../../apps/web/src/components/assistant/AtlasAssistant';

describe('ATLAS Assistant voice state integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    mocks.getActiveAtlasOrganization.mockReset().mockResolvedValue({ id: 'org-1', role: 'owner' });
    mocks.getAssistantStatus.mockReset().mockResolvedValue({
      ok: true,
      authenticated: true,
      provider: 'openai',
      provider_state: 'verified_for_request',
      model: 'gpt-6-astra',
      storage_state: 'configured',
      organization: 'org-1',
      role: 'owner',
      capabilities: ['generation', 'reasoning']
    });
    mocks.startMicrophone.mockReset();
    mocks.stopMicrophone.mockReset();
    mocks.speak.mockReset();
    mocks.setSpeechEnabled.mockReset();
  });

  it('never activates the microphone automatically after authentication', async () => {
    render(<MemoryRouter><AtlasAssistant /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /Open ATLAS Assistant/ })).toBeInTheDocument();
    expect(mocks.startMicrophone).not.toHaveBeenCalled();
  });

  it('shows listening only after real capture startup resolves', async () => {
    let resolveCapture!: () => void;
    mocks.startMicrophone.mockReturnValue(new Promise<void>((resolve) => { resolveCapture = resolve; }));
    render(<MemoryRouter><AtlasAssistant /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Open ATLAS Assistant/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enable microphone capture' }));

    expect(screen.getByText(/Idle · Intelligence/)).toBeInTheDocument();
    expect(screen.queryByText(/^Listening/)).not.toBeInTheDocument();
    resolveCapture();
    expect(await screen.findByText(/Listening · Intelligence/)).toBeInTheDocument();
  });

  it('surfaces permission denial and never claims listening', async () => {
    mocks.startMicrophone.mockRejectedValue(new Error('microphone_permission_denied'));
    render(<MemoryRouter><AtlasAssistant /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Open ATLAS Assistant/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enable microphone capture' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Microphone permission was denied'));
    expect(screen.queryByText(/^Listening/)).not.toBeInTheDocument();
  });

  it('keeps speech output disabled when the browser capability is unavailable', async () => {
    render(<MemoryRouter><AtlasAssistant /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Open ATLAS Assistant/ }));
    const speechToggle = screen.getByRole('checkbox');
    expect(speechToggle).toBeDisabled();
    expect(screen.getByText('Speech unavailable')).toBeInTheDocument();
  });
});
