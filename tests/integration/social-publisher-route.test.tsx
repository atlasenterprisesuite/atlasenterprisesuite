import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('Business Suite social publishing route', () => {
  it('renders an ASTRA-derived Business Suite home with truthful channel gating', () => {
    render(<MemoryRouter initialEntries={['/business']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Business Suite' })).toBeInTheDocument();
    expect(document.querySelector('.module-experience-page')).toBeTruthy();
    expect(screen.getByText('Growth operations, customer workflows and governed publishing under one enterprise context.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Social Publisher/i })).toHaveAttribute('href', '/business/growth/social-publisher');
    expect(screen.getByText('Channel connections').closest('[aria-disabled="true"]')).toBeTruthy();
  });

  it('opens the multi-platform publisher and keeps external publishing gated', () => {
    render(<MemoryRouter initialEntries={['/business/growth/social-publisher']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Social Publisher' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Instagram' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Publish to Instagram' })).toBeDisabled();
    expect(screen.getByText('Publishing connection required')).toBeInTheDocument();
  });
});
