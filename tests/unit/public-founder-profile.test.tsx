import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { FounderPage } from '../../apps/web/src/modules/public/FounderPage';

afterEach(() => {
  document.title = 'ATLAS Enterprise Suite';
});

describe('ATLAS public founder profile', () => {
  it('presents the founder without authentication, invented personal contact details, or unverified social profiles', () => {
    render(
      <MemoryRouter>
        <FounderPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Winder Aranguren' })).toBeInTheDocument();
    expect(screen.getByText(/ocho años de experiencia/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explorar ATLAS/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Repositorio oficial/i }))
      .toHaveAttribute('href', 'https://github.com/atlasenterprisesuite/atlasenterprisesuite');
    expect(screen.queryByText(/LinkedIn/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/LLC aprobada/i)).not.toBeInTheDocument();
  });

  it('sets and cleans up search metadata with the canonical founder URL', () => {
    const previousTitle = document.title;
    const view = render(
      <MemoryRouter>
        <FounderPage />
      </MemoryRouter>
    );
    expect(document.title).toBe('Winder Aranguren | ATLAS Enterprise Suite');
    expect(document.head.querySelector('link[rel="canonical"]'))
      .toHaveAttribute('href', 'https://www.atlasenterprisesuite.com/about/founder');
    expect(document.head.querySelector('meta[property="og:title"]'))
      .toHaveAttribute('content', 'Winder Aranguren | ATLAS Enterprise Suite');
    const schema = document.head.querySelector('script[type="application/ld+json"][data-atlas-founder]');
    expect(schema).not.toBeNull();
    expect(JSON.parse(schema?.textContent || '{}').name).toBe('Winder Aranguren');

    view.unmount();

    expect(document.title).toBe(previousTitle);
    expect(document.head.querySelector('script[data-atlas-founder]')).toBeNull();
    expect(document.head.querySelector('link[rel="canonical"][data-atlas-founder]')).toBeNull();
  });
});
