import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { FuturisticEnterpriseHome } from '../../apps/web/src/components/FuturisticEnterpriseHome';
import { resolveAtlasExtension } from '../../apps/web/src/extensions/resolveAtlasExtension';

function renderRoute(path: string) {
  return render(<MemoryRouter initialEntries={[path]}>{resolveAtlasExtension(path)}</MemoryRouter>);
}

describe('ATLAS public commercial surface', () => {
  it('renders a public pricing page from the Enterprise commercial catalog', () => {
    renderRoute('/pricing');
    expect(screen.getByRole('heading', { name: /ATLAS pricing/i })).toBeInTheDocument();
    expect(screen.getByText('ATLAS Business')).toBeInTheDocument();
    expect(screen.getByText('ATLAS Enterprise')).toBeInTheDocument();
    expect(screen.getByText('ATLAS Custom')).toBeInTheDocument();
    expect(screen.getAllByText(/Negotiated/i).length).toBeGreaterThan(0);
  });

  it.each([
    ['/request-demo', /Request an ATLAS demo/i],
    ['/contact', /Contact ATLAS/i],
    ['/terms', /ATLAS Terms of Service/i],
    ['/privacy', /ATLAS Privacy Policy/i],
    ['/security', /ATLAS Security/i]
  ])('renders %s as an anonymous commercial route', (path, heading) => {
    renderRoute(path);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('publishes identifiable legal document metadata without pretending review evidence exists', () => {
    renderRoute('/terms');
    expect(screen.getByText(/Document version: 2026-10-04-v1/i)).toBeInTheDocument();
    expect(screen.getByText(/Effective date: October 4, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Owner: ATLAS Enterprise Suite/i)).toBeInTheDocument();
    expect(screen.getByText(/legal review evidence is required/i)).toBeInTheDocument();
  });

  it('does not publish unsupported certification claims on the trust surface', () => {
    const { container } = renderRoute('/security');
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/SOC 2 certified/i);
    expect(text).not.toMatch(/HIPAA certified/i);
    expect(text).not.toMatch(/licensed bank/i);
    expect(text).not.toMatch(/licensed carrier/i);
  });

  it('adds clear pricing and demo entry points to the public home', () => {
    render(<MemoryRouter><FuturisticEnterpriseHome /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /View pricing/i })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('link', { name: /Request a demo/i })).toHaveAttribute('href', '/request-demo');
  });
});
