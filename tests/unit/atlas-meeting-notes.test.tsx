import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { resolveAtlasExtension } from '../../apps/web/src/extensions/resolveAtlasExtension';
import { createAtlasMemoryDraft, listAtlasMemory } from '../../apps/web/src/modules/knowledge/memoryApi';
import { getAssistantStatus, sendAssistantWorkspaceMessage } from '../../apps/web/src/assistant/client';
import { useAssistantVoice } from '../../apps/web/src/assistant/useAssistantVoice';

vi.mock('../../apps/web/src/identity/RequireAtlasIdentity', () => ({ RequireAtlasIdentity: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('../../apps/web/src/modules/knowledge/memoryApi', () => ({ createAtlasMemoryDraft: vi.fn(), listAtlasMemory: vi.fn() }));
vi.mock('../../apps/web/src/assistant/client', () => ({ getAssistantStatus: vi.fn(), sendAssistantWorkspaceMessage: vi.fn() }));
vi.mock('../../apps/web/src/assistant/useAssistantVoice', () => ({ useAssistantVoice: vi.fn() }));

vi.stubGlobal('React', React);

const renderNotes = () => render(<MemoryRouter>{resolveAtlasExtension('/knowledge/meeting-notes')}</MemoryRouter>);
const ready = {
  ok: true, authenticated: true, provider: 'atlas-local', provider_state: 'verified_for_request',
  model: 'local', storage_state: 'configured', organization: 'org', role: 'owner', capabilities: [],
  providers: [{ id: 'atlas-local', state: 'verified', configured: true, verified: true, model: 'local', capabilities: ['generation', 'reasoning'], profiles: ['balanced'], error: null }],
  cost_policy: { enforce_zero_cost: true, automatic_paid_calls: false, zero_cost_ready: true, zero_cost_providers: ['atlas-local'] }
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAssistantVoice).mockReturnValue({ microphoneActive: false, transcriptionCapability: 'ready', startVoiceTurn: vi.fn().mockResolvedValue(undefined), stopMicrophone: vi.fn() } as unknown as ReturnType<typeof useAssistantVoice>);
  vi.mocked(getAssistantStatus).mockResolvedValue(ready as unknown as Awaited<ReturnType<typeof getAssistantStatus>>);
});
afterEach(cleanup);

describe('ATLAS meeting notes', () => {
  it('exposes an authenticated route with editing and no automatic capture', () => {
    renderNotes();
    expect(screen.getByRole('heading', { name: /notas de reunión/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Notas')).toBeInTheDocument();
    expect(screen.getByLabelText('Transcripción')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dictar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /generar resumen/i })).toBeDisabled();
    expect(getAssistantStatus).not.toHaveBeenCalled();
    expect(vi.mocked(useAssistantVoice).mock.results[0].value.startVoiceTurn).not.toHaveBeenCalled();
  });

  it('saves only after acknowledging who can see the draft', async () => {
    vi.mocked(createAtlasMemoryDraft).mockResolvedValue({ ok: true, record: { id: 'saved' } } as Awaited<ReturnType<typeof createAtlasMemoryDraft>>);
    renderNotes();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Reunión comunitaria' } });
    fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'Verificar los requisitos.' } });
    fireEvent.change(screen.getByLabelText('Transcripción'), { target: { value: 'Hablaron de una próxima fecha.' } });
    const save = screen.getByRole('button', { name: /guardar borrador/i });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/entiendo quién puede ver/i));
    fireEvent.click(save);
    await waitFor(() => expect(createAtlasMemoryDraft).toHaveBeenCalledTimes(1));
    const input = vi.mocked(createAtlasMemoryDraft).mock.calls[0][0];
    expect(input).toMatchObject({ kind: 'note', title: 'Reunión comunitaria', sourceType: 'user_entry', sensitivity: 'restricted' });
    expect(input.content).toContain('Verificar los requisitos.');
    expect(input.content).toContain('Hablaron de una próxima fecha.');
    expect(screen.getByRole('status')).toHaveTextContent(/guardado/i);
  });

  it('keeps the note on a failed save and exposes the error', async () => {
    vi.mocked(createAtlasMemoryDraft).mockRejectedValue(new Error('memory_restricted_role_required'));
    renderNotes();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título' } });
    fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'No perder esta nota' } });
    fireEvent.click(screen.getByLabelText(/entiendo quién puede ver/i));
    fireEvent.click(screen.getByRole('button', { name: /guardar borrador/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/memory_restricted_role_required/);
    expect(screen.getByLabelText('Notas')).toHaveValue('No perder esta nota');
  });

  it('sends text for a summary only after explicit consent and a verified zero-cost provider', async () => {
    vi.mocked(sendAssistantWorkspaceMessage).mockResolvedValue({ ok: true, text: 'Resumen real del proveedor.' });
    renderNotes();
    fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'Hay que revisar el formulario.' } });
    fireEvent.click(screen.getByLabelText(/autorizo enviar/i));
    fireEvent.click(screen.getByRole('button', { name: /generar resumen/i }));
    expect(await screen.findByDisplayValue('Resumen real del proveedor.')).toBeInTheDocument();
    const input = vi.mocked(sendAssistantWorkspaceMessage).mock.calls[0][0];
    expect(input.mode).toBe('atlas-local');
    expect(input.message).toContain('Hay que revisar el formulario.');
  });

  it('blocks AI when no verified zero-cost provider exists', async () => {
    vi.mocked(getAssistantStatus).mockResolvedValue({ ...ready, cost_policy: { ...ready.cost_policy, zero_cost_ready: false } } as unknown as Awaited<ReturnType<typeof getAssistantStatus>>);
    renderNotes();
    fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'Una nota.' } });
    fireEvent.click(screen.getByLabelText(/autorizo enviar/i));
    fireEvent.click(screen.getByRole('button', { name: /generar resumen/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/proveedor.*costo cero/i);
    expect(sendAssistantWorkspaceMessage).not.toHaveBeenCalled();
  });

  it('retrieves previously saved meeting notes without mixing in unrelated memory', async () => {
    vi.mocked(listAtlasMemory).mockResolvedValue({ ok: true, organization_id: 'org', role: 'owner', total: 2, limit: 50, offset: 0, has_more: false, records: [
      { id: 'one', title: 'Reunión del martes', tags: ['meeting-notes'], content_json: { text: 'Notas:\nAcuerdo real.' }, status: 'draft', sensitivity: 'restricted' },
      { id: 'two', title: 'Otra nota', tags: [], content_json: { text: 'No pertenece a reuniones' }, status: 'draft', sensitivity: 'organization' }
    ] } as unknown as Awaited<ReturnType<typeof listAtlasMemory>>);
    renderNotes();
    fireEvent.click(screen.getByRole('button', { name: /ver notas guardadas/i }));
    expect(await screen.findByText('Reunión del martes')).toBeInTheDocument();
    expect(screen.queryByText('Otra nota')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver contenido de reunión del martes/i }));
    expect(screen.getByText(/acuerdo real/i)).toBeInTheDocument();
    expect(listAtlasMemory).toHaveBeenCalledWith(expect.objectContaining({ kind: 'note', module: 'work', offset: 0 }));
  });

  it('does not send content if consent is withdrawn while provider readiness is checked', async () => {
    let complete!: (value: Awaited<ReturnType<typeof getAssistantStatus>>) => void;
    vi.mocked(getAssistantStatus).mockReturnValue(new Promise(resolve => { complete = resolve; }));
    renderNotes();
    fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'Información de la reunión' } });
    const consent = screen.getByLabelText(/autorizo enviar/i);
    fireEvent.click(consent);
    fireEvent.click(screen.getByRole('button', { name: /generar resumen/i }));
    fireEvent.click(consent);
    complete(ready as unknown as Awaited<ReturnType<typeof getAssistantStatus>>);
    await waitFor(() => expect(screen.getByRole('button', { name: /generar resumen/i })).toBeDisabled());
    expect(sendAssistantWorkspaceMessage).not.toHaveBeenCalled();
  });

  it('requires meeting consent before starting dictation', async () => {
    const start = vi.fn().mockImplementation((onFinal: (text: string) => void) => { onFinal('Texto dictado'); return Promise.resolve(); });
    vi.mocked(useAssistantVoice).mockReturnValue({ microphoneActive: false, transcriptionCapability: 'ready', startVoiceTurn: start, stopMicrophone: vi.fn() } as unknown as ReturnType<typeof useAssistantVoice>);
    renderNotes();
    expect(screen.getByRole('button', { name: /dictar/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/tengo autorización/i));
    fireEvent.click(screen.getByRole('button', { name: /dictar/i }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Transcripción')).toHaveValue('Texto dictado');
  });
});
