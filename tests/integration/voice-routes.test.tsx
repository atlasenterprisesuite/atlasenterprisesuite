import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('ATLAS Voice governed routes', () => {
  it('renders ATLAS Voice from the canonical route graph', () => {
    render(<MemoryRouter initialEntries={['/voice']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'ATLAS Voice' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Personal Voice/i })).toHaveAttribute('href', '/voice/personal-voice');
  });

  it('renders the Personal Voice setup route', () => {
    render(<MemoryRouter initialEntries={['/voice/personal-voice/setup']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Create your Personal Voice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('is truthful about Apple web capability', () => {
    render(<MemoryRouter initialEntries={['/voice/personal-voice/apple']}><App /></MemoryRouter>);
    expect(screen.getByText(/requires the ATLAS iOS app/i)).toBeInTheDocument();
    expect(screen.getByText(/No Apple voice data is uploaded/i)).toBeInTheDocument();
  });

  it('disables Telecom when the provider has no telephony capability', () => {
    render(<MemoryRouter initialEntries={['/voice/personal-voice/permissions']}><App /></MemoryRouter>);
    expect(screen.getByRole('checkbox', { name: /ATLAS Telecom/i })).toBeDisabled();
  });

  it('requires explicit confirmation before deletion', () => {
    render(<MemoryRouter initialEntries={['/voice/personal-voice/permissions']}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Voice' }));
    expect(screen.getByRole('dialog', { name: /Delete this Personal Voice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument();
  });
});
