import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CreatorHome, CreatorProviders, CreatorWorkspace } from '../../apps/web/src/modules/creator/CreatorStudioPage';

describe('ATLAS Creator', () => {
  it('exposes working creator destinations', () => {
    render(<MemoryRouter><CreatorHome /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Create beyond the prompt.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Image Lab/ })).toHaveAttribute('href', '/studio/create?type=image');
    expect(screen.getByRole('link', { name: /Voice & Agents/ })).toHaveAttribute('href', '/studio/voice');
  });
  it('does not present generation as live without provider configuration', () => {
    render(<MemoryRouter><CreatorWorkspace /></MemoryRouter>);
    expect(screen.getByText('Not configured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate image' })).toBeDisabled();
  });
  it('reports truthful provider readiness and privacy boundaries', () => {
    render(<MemoryRouter><CreatorProviders /></MemoryRouter>);
    expect(screen.getAllByText('configuration required')).toHaveLength(4);
    expect(screen.getByText(/must never be used as silent tracking/i)).toBeInTheDocument();
  });
});
