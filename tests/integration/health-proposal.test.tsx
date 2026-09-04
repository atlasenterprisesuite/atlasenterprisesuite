import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../apps/web/src/App';

test('proposal pilot route is explicit about concept status', async () => {
  render(<MemoryRouter initialEntries={['/health/proposal/adventhealth/pilot']}><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Pilot Roadmap' })).toBeInTheDocument();
  expect(screen.getByText(/Concept proposal only/i)).toBeInTheDocument();
});
