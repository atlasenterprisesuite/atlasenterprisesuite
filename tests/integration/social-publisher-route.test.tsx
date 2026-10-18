import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';
import { resolveAtlasIdentityTarget } from '../../apps/web/src/identity/IdentityPage';
import { SocialPublisherPage } from '../../apps/web/src/modules/business/social/SocialPublisherPage';

describe('Business Suite social publishing route', () => {
  it('renders the interactive Business ecosystem home with governed module navigation', () => {
    render(<MemoryRouter initialEntries={['/business']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Ecosistema de Módulos' })).toBeInTheDocument();
    expect(document.querySelector('.business-map-page')).toBeTruthy();
    expect(screen.getByText('Una vista funcional para entender qué hace cada módulo y entrar directamente a sus herramientas reales.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Publisher' })).toHaveAttribute('href', '/business/growth/social-publisher');
    expect(screen.getByText(/solo se consideran activos cuando existe evidencia autenticada/i)).toBeInTheDocument();
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
