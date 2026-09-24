import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AviationRoutes } from '../../apps/web/src/modules/aviation/AviationRoutes';

afterEach(cleanup);

describe('ATLAS Aviation aircraft catalog page', () => {
  it('renders the ten approved internal concepts without presenting engineering metrics as validated', () => {
    render(
      <MemoryRouter initialEntries={['/mobility/aviation/aircraft']}>
        <AviationRoutes />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Aircraft Catalog' })).toBeInTheDocument();
    expect(screen.getAllByTestId('aviation-aircraft-card')).toHaveLength(10);
    expect(screen.getAllByText('Not validated').length).toBeGreaterThan(0);
    expect(screen.getByText(/Internal concept records/i)).toBeInTheDocument();
  });

  it('filters the visible catalog by search and category', () => {
    render(
      <MemoryRouter initialEntries={['/mobility/aviation/aircraft']}>
        <AviationRoutes />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Search aircraft'), { target: { value: 'rescue' } });
    expect(screen.getAllByTestId('aviation-aircraft-card')).toHaveLength(1);
    expect(screen.getByText('ATLAS A5 Rescue')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search aircraft'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Aircraft category'), { target: { value: 'cargo' } });
    expect(screen.getAllByTestId('aviation-aircraft-card')).toHaveLength(1);
    expect(screen.getByText('ATLAS A4 Cargo')).toBeInTheDocument();
  });
});
