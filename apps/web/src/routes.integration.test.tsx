import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';

const routes: Array<[string, RegExp]> = [
  ['/', /ATLAS Enterprise Suite/i],
  ['/health', /^ATLAS Health$/i],
  ['/health/research', /Research & Innovation/i],
  ['/health/research/frontiers', /^Health Frontiers$/i],
  ['/health/research/frontiers/disease-reconstruction', /^Disease Reconstruction Lab$/i]
];

test.each(routes)('%s renders its supported ATLAS destination', (route, heading) => {
  render(<MemoryRouter initialEntries={[route]}><AppRoutes /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  expect(screen.queryByText(/route not found/i)).not.toBeInTheDocument();
});
