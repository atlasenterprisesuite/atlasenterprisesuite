import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../apps/web/src/App';

test('command center renders all modules without copied reference metrics', async () => {
  render(<MemoryRouter initialEntries={['/health/operations/command-center']}><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Smart Health Command Center' })).toBeInTheDocument();
  expect(screen.getAllByTestId('health-module-card')).toHaveLength(18);
  expect(screen.queryByText('98%')).not.toBeInTheDocument();
  expect(screen.queryByText('2,847')).not.toBeInTheDocument();
});
