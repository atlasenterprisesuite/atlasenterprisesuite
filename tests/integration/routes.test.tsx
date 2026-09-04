import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('ATLAS shared shell routes', () => {
  it('renders the ATLAS application root', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'ATLAS Enterprise Suite' })).toBeInTheDocument();
  });

  it('renders intentional not found state', () => {
    render(<MemoryRouter initialEntries={['/missing']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Route not found' })).toBeInTheDocument();
  });

  it.each([
    ['/finance', 'Finance'],
    ['/finance/accounting', 'Accounting'],
    ['/health', 'ATLAS Health']
  ])('renders %s in the ATLAS shell', (path, heading) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'ATLAS modules' })).toBeInTheDocument();
  });
});
