import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CardTable } from '../../apps/web/src/modules/events/cards/CardTable';
afterEach(cleanup);
it('plays an entire local game, announces its end, and restarts', () => {
  render(<MemoryRouter><CardTable /></MemoryRouter>);
  expect(screen.getAllByRole('button', { name: /^Jugar / })).toHaveLength(5);
  for (let round = 0; round < 26; round++) fireEvent.click(screen.getAllByRole('button', { name: /^Jugar / })[0]);
  expect(screen.queryAllByRole('button', { name: /^Jugar / })).toHaveLength(0);
  expect(screen.getByRole('status')).toHaveTextContent(/partida/i);
  expect(screen.getByText(/Rondas: 26\/26/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Nueva partida local' }));
  expect(screen.getAllByRole('button', { name: /^Jugar / })).toHaveLength(5);
  expect(screen.getByText(/Rondas: 0\/26/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Events & Entertainment/ })).toHaveAttribute('href', '/events');
});
