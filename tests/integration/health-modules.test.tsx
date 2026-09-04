import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('Reusable ATLAS Health module workspace', () => {
  it('supports search, status filtering and governed tabs', async () => {
    render(<MemoryRouter initialEntries={['/health/operations/modules/smart-facilities']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Smart Facilities' })).toBeInTheDocument();
    const search = screen.getByRole('searchbox', { name: 'Search module records' });
    fireEvent.change(search, { target: { value: 'MRI' } });
    expect(screen.getByText(/MRI cooling inspection/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Integrations' }));
    expect(screen.getByText(/facilities/i)).toBeInTheDocument();
    expect(screen.getByText(/Not authorized/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Permissions' }));
    expect(screen.getByText('health.facilities.read')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Data' }));
    const status = screen.getByRole('combobox', { name: 'Record status' });
    fireEvent.change(status, { target: { value: 'closed' } });
    expect(screen.getByText('No configured data matches this search and filter.')).toBeInTheDocument();
  });

  it('keeps audit empty until scoped audit events exist', async () => {
    render(<MemoryRouter initialEntries={['/health/operations/modules/smart-facilities']}><App /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('tab', { name: 'Audit' }));
    expect(screen.getByText('No audit events for this module and organization.')).toBeInTheDocument();
  });
});
