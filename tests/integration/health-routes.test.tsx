import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../apps/web/src/App';

const cases: [string, string][] = [
  ['/health', 'Smart Health Ecosystem'],
  ['/health/proposal/adventhealth', 'Executive Summary'],
  ['/health/operations/command-center', 'Smart Health Command Center'],
  ['/health/operations/modules', 'Health Module Directory'],
  ['/health/research', 'Research & Innovation']
];

for (const [route, heading] of cases) {
  test(`renders ${route}`, async () => {
    render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });
}
