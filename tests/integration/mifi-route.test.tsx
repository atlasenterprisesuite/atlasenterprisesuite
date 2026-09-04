import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('ATLAS Telecom MiFi route', () => {
  it('renders MiFi controls inside the shared ATLAS shell without false live state', async () => {
    render(<MemoryRouter initialEntries={['/telecom/devices/mifi']}><App /></MemoryRouter>);

    expect(screen.getByRole('navigation', { name: 'ATLAS modules' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Telecom' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'MiFi Control' })).toBeInTheDocument();
    expect(screen.getByText(/No authorized MiFi device adapter is connected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate forwarding' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Verify forwarding' })).toBeDisabled();
    expect(screen.queryByText(/^Connected$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Verified$/)).not.toBeInTheDocument();
  });

  it('exposes accessible MiFi form labels and safe disabled actions', async () => {
    render(<MemoryRouter initialEntries={['/telecom/devices/mifi']}><App /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'MiFi Control' });
    expect(screen.getByLabelText('Device name')).toBeInTheDocument();
    expect(screen.getByLabelText('Carrier')).toBeInTheDocument();
    expect(screen.getByLabelText('MiFi line')).toBeInTheDocument();
    expect(screen.getByLabelText('Forward calls to')).toBeInTheDocument();
    expect(screen.getByLabelText('Forwarding mode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disable forwarding' })).toBeDisabled();
  });
});
