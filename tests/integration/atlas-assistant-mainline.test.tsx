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
  enqueueAssistantRepair: vi.fn(),
  getAssistantRepairs: vi.fn(),
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
    sendAssistantMessage: mocks.sendAssistantMessage
  };
});

vi.mock('../../apps/web/src/assistant/repairClient', () => ({
  enqueueAssistantRepair: mocks.enqueueAssistantRepair,
  getAssistantRepairs: mocks.getAssistantRepairs
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
    mocks.sendAssistantMessage.mockReset().mockResolvedValue({
      ok: true,
      text: 'Voice answer',
      conversation_id: 'conv-1'
    });
    mocks.enqueueAssistantRepair.mockReset().mockResolvedValue({
      ok: true,
      job: { id: 'repair-1', status: 'pending' },
      execution: 'supabase-native',
      github_required: false
    });
    mocks.getAssistantRepairs.mockReset().mockResolvedValue({
      ok: true,
      jobs: [
        { id: 'repair-1', status: 'pending', request_text: 'Fix mobile approval controls' }
      ],
      execution: 'supabase-native'
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
    expect(screen.getByLabelText('Message ATLAS Assistant')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
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
      modality: 'voice',
      elementContext: null
    }));

    expect(await screen.findByText('Summarize overdue payables')).toBeInTheDocument();
    expect(await screen.findByText('Voice answer')).toBeInTheDocument();
  });

  it('offers one-tap current-screen explain, check, and repair actions', async () => {
    render(<MemoryRouter initialEntries={['/finance/accounting/accounts-payable']}><AtlasAssistant /></MemoryRouter>);
    const launcher = await screen.findByRole('button', { name: /Open ATLAS Assistant, Intelligence gemini ready/i });
    fireEvent.click(launcher);

    expect(screen.getByText('Current screen · safe structural context')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explain screen' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Check screen' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Repair this screen' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Repair queue' })).toBeEnabled();
    await waitFor(() => expect(mocks.getAssistantRepairs).toHaveBeenCalled());
    expect(await screen.findByText('Repairs · 1 active · 0 failed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Explain screen' }));
    await waitFor(() => expect(mocks.sendAssistantMessage).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/finance/accounting/accounts-payable',
      message: expect.stringContaining('Explain the current ATLAS screen')
    })));

    fireEvent.click(screen.getByRole('button', { name: 'Repair this screen' }));
    await waitFor(() => expect(mocks.enqueueAssistantRepair).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/finance/accounting/accounts-payable',
      message: expect.stringContaining('Inspect and repair verified defects on the current ATLAS screen')
    })));

    const repairStatusCalls = mocks.getAssistantRepairs.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Repair queue' }));
    await waitFor(() => expect(mocks.getAssistantRepairs.mock.calls.length).toBeGreaterThan(repairStatusCalls));
    expect(await screen.findByText(/Recent repair tasks:/)).toBeInTheDocument();
    expect(screen.getByText(/PENDING — Fix mobile approval controls · repair-1/)).toBeInTheDocument();
  });

  it('selects a concrete page element and repairs only its structural target', async () => {
    render(
      <>
        <button data-atlas-component="approvalAction" aria-label="Approve payment">Approve</button>
        <MemoryRouter initialEntries={['/finance/accounting/accounts-payable']}><AtlasAssistant /></MemoryRouter>
      </>
    );
    const launcher = await screen.findByRole('button', { name: /Open ATLAS Assistant, Intelligence gemini ready/i });
    fireEvent.click(launcher);

    fireEvent.click(screen.getByRole('button', { name: 'Select element' }));
    expect(screen.getByRole('button', { name: 'Cancel selection' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve payment' }));

    expect(await screen.findByText('Selected · approvalAction')).toBeInTheDocument();
    expect(await screen.findByText(/Selected element: approvalAction/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Repair selected' }));

    await waitFor(() => expect(mocks.enqueueAssistantRepair).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/finance/accounting/accounts-payable',
      message: expect.stringContaining('selected ATLAS element'),
      elementContext: expect.objectContaining({
        component: 'approvalAction',
        tag: 'button'
      })
    })));
  });

  it('queues a governed repair from the current ATLAS screen', async () => {
    render(<MemoryRouter initialEntries={['/finance/accounting/accounts-payable']}><AtlasAssistant /></MemoryRouter>);
    const launcher = await screen.findByRole('button', { name: /Open ATLAS Assistant, Intelligence gemini ready/i });
    fireEvent.click(launcher);

    const input = screen.getByLabelText('Message ATLAS Assistant');
    fireEvent.change(input, { target: { value: 'The approval actions are clipped on mobile' } });
    fireEvent.click(screen.getByRole('button', { name: 'Queue repair' }));

    await waitFor(() => expect(mocks.enqueueAssistantRepair).toHaveBeenCalledWith({
      message: 'The approval actions are clipped on mobile',
      pathname: '/finance/accounting/accounts-payable',
      conversationId: null,
      elementContext: null
    }));
    expect(await screen.findByText(/Repair task repair-1 queued securely/)).toBeInTheDocument();
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
