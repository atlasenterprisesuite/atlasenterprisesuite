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

describe('ATLAS Aviation certification and investment surfaces', () => {
  it('renders certification intelligence without inventing certified states', () => {
    renderRoute('/mobility/aviation/certification');

    expect(screen.getByRole('heading', { name: 'Certification Intelligence' })).toBeInTheDocument();
    expect(screen.getAllByTestId('aviation-certification-card')).toHaveLength(10);
    expect(screen.getAllByText('Evidence not configured')).toHaveLength(10);
    expect(screen.queryByText('Certified')).not.toBeInTheDocument();
  });

  it('keeps investment intelligence read-only with visible risk disclosure', () => {
    renderRoute('/mobility/aviation/aircraft/atlas-a5-rescue');
    fireEvent.click(screen.getByRole('tab', { name: 'Investment' }));

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent(/may be illiquid and may result in total loss/i);
    expect(panel).toHaveTextContent('Investment data is not configured');
    expect(screen.queryByRole('button', { name: /invest|buy|complete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /official offering/i })).not.toBeInTheDocument();
  });

  it('connects the Aviation home to the certification tracker', () => {
    renderRoute('/mobility/aviation');
    expect(screen.getByRole('link', { name: /Authority-backed status/i })).toHaveAttribute(
      'href',
      '/mobility/aviation/certification'
    );
  });
});
