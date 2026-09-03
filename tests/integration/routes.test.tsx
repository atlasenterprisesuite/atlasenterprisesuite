// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, test } from 'vitest';
import { App } from '../../apps/web/src/App';

test('renders the ATLAS application root', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );

  expect(
    screen.getByRole('heading', { name: 'ATLAS Enterprise Suite' }),
  ).toBeInTheDocument();
});

test('renders intentional not found state', () => {
  render(
    <MemoryRouter initialEntries={['/missing']}>
      <App />
    </MemoryRouter>,
  );

  expect(screen.getByRole('heading', { name: 'Route not found' })).toBeInTheDocument();
});

it.each([
  ['/finance', 'Finance'],
  ['/finance/accounting', 'Accounting'],
  ['/health', 'ATLAS Health'],
])('renders %s in the ATLAS shell', (path, heading) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'ATLAS modules' })).toBeInTheDocument();
  expect(screen.getByText('Demo environment')).toBeInTheDocument();
});

it.each([
  '/health/research',
  '/health/research/frontiers',
  '/health/research/frontiers/disease-reconstruction',
  '/health/research/frontiers/disease-reconstruction/diseases',
  '/health/research/frontiers/disease-reconstruction/diseases/demo-disease',
  '/health/research/frontiers/disease-reconstruction/neural-graph',
  '/health/research/frontiers/disease-reconstruction/evidence',
  '/health/research/frontiers/disease-reconstruction/falsification',
  '/health/research/frontiers/disease-reconstruction/vulnerability',
  '/health/research/frontiers/disease-reconstruction/curability',
  '/health/research/frontiers/disease-reconstruction/updates',
  '/health/research/frontiers/disease-reconstruction/settings',
])('preserves known historical Health route %s as an explicit degraded state', (path) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

  expect(screen.getByRole('heading', { name: 'ATLAS Health' })).toBeInTheDocument();
  expect(screen.getByText('Historical Health source unavailable in this baseline')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Route not found' })).not.toBeInTheDocument();
});
