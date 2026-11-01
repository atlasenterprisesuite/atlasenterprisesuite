import React from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';
afterEach(cleanup);
it.each(['/health/anatomy/lumbar', '/learning/anatomy/lumbar'])('opens shared explorer at %s', route => {
  render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', {name: 'Explora la columna lumbar'})).toBeInTheDocument();
  expect(screen.getByText(/Revisión anatómica profesional pendiente/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Disco'}));
  expect(screen.getByRole('status')).toHaveTextContent('Disco seleccionado');
  fireEvent.click(screen.getByRole('checkbox', {name: 'Mostrar disco'}));
  expect(screen.queryByRole('button', {name: 'Disco'})).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Ninguna estructura seleccionada');
  fireEvent.click(screen.getByRole('button', {name: 'Restablecer'}));
  expect(screen.getByRole('button', {name: 'Disco'})).toBeInTheDocument();
});
