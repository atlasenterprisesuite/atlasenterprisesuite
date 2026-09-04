import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('Smart Health Command Center', () => {
  it('renders governed demo metrics and all 18 module links', async () => {
    render(<MemoryRouter initialEntries={['/health/operations/command-center']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Smart Health Command Center' })).toBeInTheDocument();
    expect(screen.getAllByTestId('health-module-card')).toHaveLength(18);
    expect(screen.getByRole('status')).toHaveTextContent('DEMO DATA');
    expect(screen.queryByText('98%')).not.toBeInTheDocument();
  });

  it('searches the module directory and exposes an empty state', async () => {
    render(<MemoryRouter initialEntries={['/health/operations/modules']}><App /></MemoryRouter>);
    const search = await screen.findByRole('searchbox', { name: 'Search modules' });
    fireEvent.change(search, { target: { value: 'Smart Facilities' } });
    expect(screen.getByRole('link', { name: /Smart Facilities/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pharmacy 4.0/i })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'no-match-module' } });
    expect(screen.getByRole('status')).toHaveTextContent('No Health modules match this search.');
  });
});
