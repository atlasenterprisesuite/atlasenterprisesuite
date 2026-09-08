import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';
import { clearAtlasSession } from '../../apps/web/src/lib/atlasSession';

afterEach(() => {
  clearAtlasSession();
  window.localStorage.clear();
});

describe('ATLAS Identity route', () => {
  it('renders the central identity sign-in screen instead of the route-not-found page', () => {
    render(
      <MemoryRouter initialEntries={['/identity?app=%2Ffinance%2Faccounting%2Faccounts-payable']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'ATLAS Identity' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in to ATLAS' })).toBeInTheDocument();
    expect(screen.queryByText('Route not found')).not.toBeInTheDocument();
  });
});
