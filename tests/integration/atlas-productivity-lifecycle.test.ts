import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductivityProPage } from '../../apps/web/src/modules/creator/ProductivityProPage';
import { sendAssistantWorkspaceMessage } from '../../apps/web/src/assistant/client';

vi.mock('../../apps/web/src/assistant/client', () => ({
  getAssistantStatus: vi.fn(async () => ({})),
  hasVerifiedAssistantProvider: vi.fn(() => true),
  sendAssistantWorkspaceMessage: vi.fn()
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Productivity Pro React lifecycle', () => {
  it('cancels locally and ignores a late result after restarting', async () => {
    const send = vi.mocked(sendAssistantWorkspaceMessage);
    let resolveFirst!: (value: Awaited<ReturnType<typeof send>>) => void;
    send.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
    send.mockResolvedValueOnce({ ok: true, text: 'fresh result' });
    render(React.createElement(MemoryRouter, null, React.createElement(ProductivityProPage)));
    const run = await screen.findByRole('button', { name: 'Run Researcher' });
    await waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'first request' } });
    fireEvent.click(run);
    const signal = send.mock.calls[0][0].signal;
    fireEvent.click(screen.getByRole('button', { name: 'Cancel local request' }));
    expect(signal?.aborted).toBe(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'second request' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run Researcher' }));
    await screen.findByText('fresh result');
    await act(async () => { resolveFirst({ ok: true, text: 'stale result' }); });
    expect(screen.queryByText('stale result')).toBeNull();
    expect(screen.getByText('fresh result')).toBeTruthy();
  });
});
