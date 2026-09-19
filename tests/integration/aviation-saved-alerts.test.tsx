import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
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

describe('ATLAS Aviation Saved and Alerts capability boundaries', () => {
  it('renders Saved Aircraft as explicitly not configured without fake write actions', () => {
    renderRoute('/mobility/aviation/saved');

    expect(screen.getByRole('heading', { name: 'Saved Aircraft' })).toBeInTheDocument();
    expect(screen.getByText(/Persistence not configured/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save|remove/i })).not.toBeInTheDocument();
  });

  it('renders Aviation Alerts as explicitly not configured without fake rule creation', () => {
    renderRoute('/mobility/aviation/alerts');

    expect(screen.getByRole('heading', { name: 'Aviation Alerts' })).toBeInTheDocument();
    expect(screen.getByText(/Persistence not configured/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create|enable|save/i })).not.toBeInTheDocument();
  });

  it('connects Aviation home navigation to Saved and Alerts surfaces', () => {
    renderRoute('/mobility/aviation');

    expect(screen.getByRole('link', { name: /Saved Aircraft/i })).toHaveAttribute('href', '/mobility/aviation/saved');
    expect(screen.getByRole('link', { name: /Aviation Alerts/i })).toHaveAttribute('href', '/mobility/aviation/alerts');
  });
});
