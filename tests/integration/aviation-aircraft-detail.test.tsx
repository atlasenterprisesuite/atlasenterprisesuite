import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AviationRoutes } from '../../apps/web/src/modules/aviation/AviationRoutes';

afterEach(cleanup);

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AviationRoutes />
    </MemoryRouter>
  );
}

describe('ATLAS Aviation aircraft detail', () => {
  it('renders a governed concept detail with accessible tabs and unvalidated specifications', () => {
    renderRoute('/mobility/aviation/aircraft/atlas-a5-rescue');

    expect(screen.getByRole('heading', { name: 'ATLAS A5 Rescue' })).toBeInTheDocument();
    expect(screen.getByText('Internal concept')).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Specifications',
      'Certification',
      'Company',
      'Investment',
      'Documents',
      'News'
    ]);

    fireEvent.click(screen.getByRole('tab', { name: 'Specifications' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Not validated');
    expect(screen.getByText(/No engineering specification is promoted as verified/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Certification' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Evidence not configured');
  });

  it('renders a controlled not-found state for an unknown aircraft', () => {
    renderRoute('/mobility/aviation/aircraft/unknown-aircraft');

    expect(screen.getByRole('heading', { name: 'Aircraft not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to Aircraft Catalog' })).toHaveAttribute('href', '/mobility/aviation/aircraft');
  });

  it('links catalog records into the real detail route', () => {
    renderRoute('/mobility/aviation/aircraft');
    expect(screen.getByRole('link', { name: 'Open ATLAS A5 Rescue' })).toHaveAttribute(
      'href',
      '/mobility/aviation/aircraft/atlas-a5-rescue'
    );
  });
});
