import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const saveDraft = vi.hoisted(() => vi.fn(async (_input: unknown) => ({ ok: true, record: { id: 'new-record' } })));
vi.mock('../../apps/web/src/modules/knowledge/memoryApi', () => ({
  createAtlasMemoryDraft: (...args: unknown[]) => saveDraft(...args)
}));

import { MusicChatHistoryPanel } from '../../apps/web/src/modules/creator/music/MusicChatHistoryPanel';

afterEach(() => { saveDraft.mockClear(); vi.restoreAllMocks(); });

const exportData = JSON.stringify([
  { id: 'conv-1', title: 'Atlas Music songs', mapping: { a: {
    message: { author: { role: 'user' }, content: { parts: ['Study Spotify music and musical symbolism'] } }
  } } },
  { id: 'conv-2', title: 'Unrelated finance', mapping: { a: {
    message: { author: { role: 'user' }, content: { parts: ['Reconcile the expense account'] } }
  } } }
]);

describe('ATLAS Music private conversation history UI', () => {
  it('only reads an intentionally selected export locally and does not send raw messages', async () => {
    render(<MusicChatHistoryPanel />);
    expect(screen.getByRole('heading', { name: /Music chat history/i })).toBeInTheDocument();
    expect(screen.getByText(/No chat export has been selected/i)).toBeInTheDocument();
    expect(saveDraft).not.toHaveBeenCalled();
    const file = new File([exportData], 'conversations.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => exportData });
    fireEvent.change(screen.getByLabelText(/Choose ChatGPT conversations JSON/i), { target: { files: [file] } });
    expect(await screen.findByText(/1 music-related conversation/i)).toBeInTheDocument();
    expect(screen.getByText('Atlas Music songs')).toBeInTheDocument();
    expect(screen.queryByText(/Study Spotify music/)).not.toBeInTheDocument();
    expect(saveDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Save restricted draft: Atlas Music songs/i }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      sensitivity: 'restricted', sourceType: 'chat_import', sourceRef: 'chatgpt:conv-1',
      moduleIds: ['studio', 'knowledge']
    }));
    expect(JSON.stringify(saveDraft.mock.calls)).not.toContain('Study Spotify music');
  });

  it('does not accept a zip or parse unsupported file shape', async () => {
    render(<MusicChatHistoryPanel />);
    const file = new File(['nope'], 'export.zip', { type: 'application/zip' });
    Object.defineProperty(file, 'text', { value: async () => 'notjson' });
    fireEvent.change(screen.getByLabelText(/Choose ChatGPT conversations JSON/i), { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/choose the extracted conversations json file/i);
    expect(saveDraft).not.toHaveBeenCalled();
  });
});
