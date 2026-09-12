import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';
import { clearAtlasSession } from '../../apps/web/src/lib/atlasSession';

afterEach(() => {
  clearAtlasSession();
  window.localStorage.clear();
});

describe('ATLAS Hospitality root routing regression', () => {
  it('never sends /hospitality/access to the generic route-not-found screen', () => {
    render(
      <MemoryRouter initialEntries={['/hospitality/access']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.queryByRole('heading', { name: 'Route not found' })).not.toBeInTheDocument();
  });
});
