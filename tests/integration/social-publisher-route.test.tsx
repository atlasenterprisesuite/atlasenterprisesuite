import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';
import { resolveAtlasIdentityTarget } from '../../apps/web/src/identity/IdentityPage';
import { SocialPublisherPage } from '../../apps/web/src/modules/business/social/SocialPublisherPage';

describe('Business Suite social publishing route', () => {
  it('renders an ASTRA-derived Business Suite home with truthful channel gating', () => {
    render(<MemoryRouter initialEntries={['/business']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Business Suite' })).toBeInTheDocument();
    expect(document.querySelector('.module-experience-page')).toBeTruthy();
    expect(screen.getByText('Growth operations, customer workflows and governed publishing under one enterprise context.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Social Publisher/i })).toHaveAttribute('href', '/business/growth/social-publisher');
    expect(screen.getByText('Channel connections').closest('[aria-disabled="true"]')).toBeTruthy();
  });

  it('requires ATLAS Identity and preserves the publisher return target', async () => {
    window.localStorage.clear();
    render(<MemoryRouter initialEntries={['/business/growth/social-publisher']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'ATLAS Identity' })).toBeInTheDocument();
    expect(screen.getByText('/business/growth/social-publisher')).toBeInTheDocument();
    expect(resolveAtlasIdentityTarget('/business/growth/social-publisher')).toBe('/business/growth/social-publisher');
  });

  it('keeps direct provider execution gated inside the publisher workspace', () => {
    render(<MemoryRouter initialEntries={['/business/growth/social-publisher']}><SocialPublisherPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Social Publisher' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Instagram' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Publish to Instagram' })).toBeDisabled();
    expect(screen.getByText('Publishing connection required')).toBeInTheDocument();
  });
});
