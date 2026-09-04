import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../apps/web/src/App';

test('preserves Health Frontiers route', async () => {
  render(<MemoryRouter initialEntries={['/health/research/frontiers']}><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Health Frontiers' })).toBeInTheDocument();
});

test('preserves disease reconstruction route without inventing evidence', async () => {
  render(<MemoryRouter initialEntries={['/health/research/frontiers/disease-reconstruction']}><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Disease Reconstruction Lab' })).toBeInTheDocument();
  expect(screen.getByText(/not represented as restored/i)).toBeInTheDocument();
});
