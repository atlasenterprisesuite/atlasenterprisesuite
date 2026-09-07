import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';

beforeEach(() => localStorage.clear());

describe('Creator Studio and ATLAS Connect routes', () => {
  it('renders the WhatsApp Channel destination truthfully', () => {
    render(<MemoryRouter initialEntries={['/connect/destinations/whatsapp-channel']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Atlas Enterprise Suite News' })).toBeInTheDocument();
    expect(screen.getByText(/manual handoff/i)).toBeInTheDocument();
    expect(screen.getByText(/not automated/i)).toBeInTheDocument();
  });

  it('does not show publication success after merely opening the channel', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<MemoryRouter initialEntries={['/studio/publish']}><App /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Post text'), { target: { value: 'ATLAS update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark ready' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open WhatsApp Channel to publish' }));

    expect(open).toHaveBeenCalledWith(
      'https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32',
      '_blank',
      'noopener,noreferrer'
    );
    expect(screen.getByText(/awaiting manual confirmation/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Published$/i)).not.toBeInTheDocument();
    open.mockRestore();
  });

  it('requires explicit confirmation before creating a published receipt', () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<MemoryRouter initialEntries={['/studio/publish']}><App /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Post text'), { target: { value: 'ATLAS update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark ready' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open WhatsApp Channel to publish' }));
    fireEvent.click(screen.getByRole('button', { name: 'I published this update' }));

    expect(screen.getByText(/^Published$/i)).toBeInTheDocument();
    expect(screen.getByText(/manual confirmation receipt recorded/i)).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('fails validation without promoting an empty draft', () => {
    render(<MemoryRouter initialEntries={['/studio/publish']}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark ready' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/content is required/i);
    expect(screen.queryByText(/^Ready$/i)).not.toBeInTheDocument();
  });

  it('shows an empty publication history truthfully', () => {
    render(<MemoryRouter initialEntries={['/connect/publications']}><App /></MemoryRouter>);
    expect(screen.getByText(/No publication receipts yet/i)).toBeInTheDocument();
  });
});
