import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getActiveAtlasOrganization: vi.fn(),
  sendAssistantMessage: vi.fn()
}));

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  ATLAS_SESSION_EVENT: 'atlas-session-changed',
  getActiveAtlasOrganization: mocks.getActiveAtlasOrganization
}));

vi.mock('../../apps/web/src/assistant/client', () => ({
  sendAssistantMessage: mocks.sendAssistantMessage
}));

import { AtlasShell } from '../../apps/web/src/components/AtlasShell';

describe('AtlasShell assistant integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    mocks.getActiveAtlasOrganization.mockReset();
    mocks.sendAssistantMessage.mockReset();
  });

  it('shows the launcher after active organization resolution', async () => {
    mocks.getActiveAtlasOrganization.mockResolvedValue({ id: 'org-1', role: 'owner' });
    render(<MemoryRouter><AtlasShell><div>Workspace</div></AtlasShell></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Open ATLAS Assistant' })).toBeInTheDocument();
  });

  it('stays hidden when the session has no active organization', async () => {
    mocks.getActiveAtlasOrganization.mockRejectedValue(new Error('no_active_organization'));
    render(<MemoryRouter><AtlasShell><div>Workspace</div></AtlasShell></MemoryRouter>);
    await waitFor(() => expect(mocks.getActiveAtlasOrganization).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Open ATLAS Assistant' })).not.toBeInTheDocument();
  });

  it('opens the panel and sends text through the governed client', async () => {
    mocks.getActiveAtlasOrganization.mockResolvedValue({ id: 'org-1', role: 'owner' });
    mocks.sendAssistantMessage.mockResolvedValue({ ok: true, text: 'I can help with Finance.', conversation_id: 'conv-1' });
    render(
      <MemoryRouter initialEntries={['/finance']}>
        <AtlasShell><div>Workspace</div></AtlasShell>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Open ATLAS Assistant' }));
    expect(screen.getByRole('region', { name: 'ATLAS Assistant' })).toBeInTheDocument();
    const input = screen.getByLabelText('Message ATLAS Assistant');
    fireEvent.change(input, { target: { value: 'Help me with finance' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(mocks.sendAssistantMessage).toHaveBeenCalledWith({
      message: 'Help me with finance',
      pathname: '/finance',
      conversationId: null,
      modality: 'text'
    }));
    expect(await screen.findByText('I can help with Finance.')).toBeInTheDocument();
  });

  it('shows the greeting once per browser session', async () => {
    mocks.getActiveAtlasOrganization.mockResolvedValue({ id: 'org-1', role: 'owner' });
    const first = render(<MemoryRouter><AtlasShell><div>Workspace</div></AtlasShell></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Open ATLAS Assistant' }));
    expect(screen.getByText('ATLAS Assistant is ready. How can I help in this workspace?')).toBeInTheDocument();
    first.unmount();

    render(<MemoryRouter><AtlasShell><div>Workspace</div></AtlasShell></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Open ATLAS Assistant' }));
    expect(screen.queryByText('ATLAS Assistant is ready. How can I help in this workspace?')).not.toBeInTheDocument();
  });
});
