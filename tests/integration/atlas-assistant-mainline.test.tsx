import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let voiceFinal: ((transcript: string, confidence?: number) => void) | null = null;
let voiceError: ((error: Error) => void) | null = null;

const mocks = vi.hoisted(() => ({
  getActiveAtlasOrganization: vi.fn(),
  getAssistantStatus: vi.fn(),
  sendAssistantMessage: vi.fn(),
  listAssistantRepairJobs: vi.fn(),
  queueAssistantRepair: vi.fn(),
  loadAtlasInternalControl: vi.fn(),
  startMicrophone: vi.fn(),
  startVoiceTurn: vi.fn(),
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
    sendAssistantMessage: mocks.sendAssistantMessage,
    listAssistantRepairJobs: mocks.listAssistantRepairJobs,
    queueAssistantRepair: mocks.queueAssistantRepair
  };
});

vi.mock('../../apps/web/src/assistant/internalControl', () => ({
  loadAtlasInternalControl: mocks.loadAtlasInternalControl
}));

vi.mock('../../apps/web/src/assistant/useAssistantVoice', () => ({
  useAssistantVoice: () => ({
    microphoneCapability: 'permission-required',
    microphoneActive: false,
    transcriptionCapability: 'ready',
    speechCapability: 'unavailable',
    speechEnabled: false,
    setSpeechEnabled: mocks.setSpeechEnabled,
    startMicrophone: mocks.startMicrophone,
    startVoiceTurn: mocks.startVoiceTurn,
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
    voiceFinal = null;
    voiceError = null;
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
    mocks.listAssistantRepairJobs.mockReset().mockResolvedValue([
      { id: 'repair-1', request_text: 'Repair production auth', status: 'pending' }
    ]);
    mocks.queueAssistantRepair.mockReset().mockResolvedValue({
      id: 'repair-2',
      request_text: 'Repair runtime blocker',
      status: 'pending'
    });
    mocks.loadAtlasInternalControl.mockReset().mockResolvedValue({
      role: 'owner',
      privileged: true,
      connections: [
        { id: 'conn-1', provider: 'github', mechanism: 'oauth', status: 'active', capabilities: ['repo.read'] },
        { id: 'conn-2', provider: 'cloudflare', mechanism: 'vault', status: 'active', capabilities: ['workers.deploy'] }
      ],
      productionReadiness: 'partial',
      blockers: [
        { stage: 'runtime', code: 'provider_unavailable', detail: 'ATLAS Local requires verification.' }
      ]
    });
    mocks.sendAssistantMessage.mockReset().mockResolvedValue({
      ok: true,
      text: 'Voice answer',
      conversation_id: 'conv-1'
    });
    mocks.startMicrophone.mockReset();
    mocks.startVoiceTurn.mockReset().mockImplementation(async (onFinal, onError) => {
      voiceFinal = onFinal;
      voiceError = onError;
    });
    mocks.stopMicrophone.mockReset();
    mocks.stopSpeech.mockReset();
    mocks.speak.mockReset();
    mocks.setSpeechEnabled.mockReset();
  });

  it('shows the authenticated launcher when any governed provider is verified', async () => {
    render(<MemoryRouter initialEntries={['/hospitality']}><AtlasAssistant /></MemoryRouter>);
    const launcher = await screen.findByRole('button', { name: /Open ATLAS Assistant, Intelligence gemini ready/i });
    expect(launcher).toBeInTheDocument();
    expect(mocks.startVoiceTurn).not.toHaveBeenCalled();

    fireEvent.click(launcher);
    expect(await screen.findByText('ATLAS Assistant is ready. How can I help in this workspace?')).toBeInTheDocument();
    expect(screen.getByText(/Hospitality/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Speak to ATLAS' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Speak to ATLAS' })).toBeDisabled();
    expect(screen.queryByText('ATLAS Assistant is ready. How can I help in this workspace?')).not.toBeInTheDocument();
  });

  it('refreshes provider readiness when the Assistant opens after a runtime recovery', async () => {
    const unavailable = {
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
        { id: 'atlas-local', state: 'unavailable', configured: true, verified: false, model: 'atlas-local-free', capabilities: ['generation', 'reasoning'], profiles: ['balanced'], error: 'provider_unavailable' }
      ]
    };
    const recovered = {
      ...unavailable,
      providers: [
        { id: 'atlas-local', state: 'verified', configured: true, verified: true, model: 'atlas-local-free', capabilities: ['generation', 'reasoning'], profiles: ['balanced'], error: null }
      ]
    };
    mocks.getAssistantStatus.mockReset()
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValue(recovered);

    render(<MemoryRouter initialEntries={['/ride']}><AtlasAssistant /></MemoryRouter>);
    const launcher = await screen.findByRole('button', { name: /Intelligence unavailable/i });
    fireEvent.click(launcher);

    await waitFor(() => expect(mocks.getAssistantStatus).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('ATLAS Assistant is ready. How can I help in this workspace?')).toBeInTheDocument();
    expect(screen.getByLabelText('Message ATLAS Assistant')).toBeEnabled();
  });

  it('opens internal owner controls in the floating assistant and surfaces authorized accounts', async () => {
    render(<MemoryRouter initialEntries={['/finance']}><AtlasAssistant /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Open ATLAS Assistant, Intelligence gemini ready/i }));

    const internal = await screen.findByRole('button', { name: 'Internal control' });
    fireEvent.click(internal);

    expect(await screen.findByRole('button', { name: 'Automations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My accounts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'System health' })).toBeInTheDocument();
    expect(screen.getByText('github · active')).toBeInTheDocument();
    expect(screen.getByText('cloudflare · active')).toBeInTheDocument();
    expect(screen.getByText('provider_unavailable')).toBeInTheDocument();
  });

  it('queues a governed internal repair from the popup without bypassing the repair bridge', async () => {
    render(<MemoryRouter initialEntries={['/finance']}><AtlasAssistant /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Open ATLAS Assistant, Intelligence gemini ready/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Internal control' }));

    const input = screen.getByLabelText('Internal repair request');
    fireEvent.change(input, { target: { value: 'Repair runtime blocker' } });
    fireEvent.click(screen.getByRole('button', { name: 'Queue repair' }));

    await waitFor(() => expect(mocks.queueAssistantRepair).toHaveBeenCalledWith({
      request: 'Repair runtime blocker',
      pathname: '/finance',
      module: 'finance'
    }));
    expect(await screen.findByText(/Internal repair queued as repair-2/)).toBeInTheDocument();
  });

  it('does not expose internal owner controls to an ordinary member role', async () => {
    mocks.getAssistantStatus.mockResolvedValue({
      ok: true,
      authenticated: true,
      provider: 'gemini',
      provider_state: 'verified_for_request',
      model: 'gemini-live',
      storage_state: 'configured',
      organization: 'org-1',
      role: 'member',
      capabilities: ['generation'],
      providers: [
        { id: 'gemini', state: 'verified', configured: true, verified: true, model: 'gemini-live', capabilities: ['generation'], profiles: ['balanced'], error: null }
      ]
    });

    render(<MemoryRouter initialEntries={['/finance']}><AtlasAssistant /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Open ATLAS Assistant, Intelligence gemini ready/i }));
    expect(screen.queryByRole('button', { name: 'Internal control' })).not.toBeInTheDocument();
    expect(mocks.queueAssistantRepair).not.toHaveBeenCalled();
  });

  it('sends a recognized final utterance through atlas-copilot as voice modality', async () => {
    render(<MemoryRouter initialEntries={['/finance/accounting/accounts-payable']}><AtlasAssistant /></MemoryRouter>);
    const launcher = await screen.findByRole('button', { name: /Open ATLAS Assistant, Intelligence gemini ready/i });
    fireEvent.click(launcher);

    fireEvent.click(screen.getByRole('button', { name: 'Speak to ATLAS' }));
    await waitFor(() => expect(mocks.startVoiceTurn).toHaveBeenCalledOnce());

    await act(async () => {
      voiceFinal?.('Summarize overdue payables', 0.94);
    });

    await waitFor(() => expect(mocks.sendAssistantMessage).toHaveBeenCalledWith({
      message: 'Summarize overdue payables',
      pathname: '/finance/accounting/accounts-payable',
      conversationId: null,
      modality: 'voice'
    }));

    expect(await screen.findByText('Summarize overdue payables')).toBeInTheDocument();
    expect(await screen.findByText('Voice answer')).toBeInTheDocument();
  });

  it('surfaces recognition failures without sending a request', async () => {
    render(<MemoryRouter><AtlasAssistant /></MemoryRouter>);
    const launcher = await screen.findByRole('button', { name: /Open ATLAS Assistant, Intelligence gemini ready/i });
    fireEvent.click(launcher);
    fireEvent.click(screen.getByRole('button', { name: 'Speak to ATLAS' }));

    await waitFor(() => expect(mocks.startVoiceTurn).toHaveBeenCalledOnce());
    await act(async () => {
      voiceError?.(new Error('voice_no_speech'));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('ATLAS did not hear a complete phrase');
    expect(mocks.sendAssistantMessage).not.toHaveBeenCalled();
  });
});
