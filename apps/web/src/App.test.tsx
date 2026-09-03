import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );
}

describe('ATLAS Health application routes', () => {
  it('renders the full Disease Reconstruction Lab route with research-only safety state and return navigation', () => {
    renderAt('/health/research/frontiers/disease-reconstruction');

    expect(screen.getByRole('heading', { name: /Disease Reconstruction Lab/i })).toBeInTheDocument();
    expect(screen.getByText(/Research-only workspace/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Neural Graph/i })).toHaveAttribute('href', '/health/research/frontiers/disease-reconstruction/neural-graph');
    expect(screen.getByRole('link', { name: /Evidence Registry/i })).toHaveAttribute('href', '/health/research/frontiers/disease-reconstruction/evidence');
    expect(screen.getByRole('link', { name: 'Breadcrumb Research & Innovation' })).toHaveAttribute('href', '/health/research');
    expect(screen.getByRole('link', { name: 'Breadcrumb Health Frontiers' })).toHaveAttribute('href', '/health/research/frontiers');
  });

  it('navigates from Health to Research & Innovation without dead controls', async () => {
    const user = userEvent.setup();
    renderAt('/health');

    expect(screen.getByRole('heading', { name: /ATLAS Health/i })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /Research & Innovation/i }));
    expect(screen.getByRole('heading', { name: /Research & Innovation/i })).toBeInTheDocument();
  });

  it('filters Neural Graph nodes by evidence level and status', async () => {
    const user = userEvent.setup();
    renderAt('/health/research/frontiers/disease-reconstruction/neural-graph');

    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText('Evidence level filter'), 'human_randomized');
    expect(screen.getByText(/No graph data/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Evidence level filter'), 'all');
    await user.selectOptions(screen.getByLabelText('Status filter'), 'falsified');
    expect(screen.getByText(/No graph data/i)).toBeInTheDocument();
  });

  it('shows an explicit not-found state for unsupported paths instead of a blank screen', () => {
    renderAt('/health/not-a-real-route');
    expect(screen.getByRole('heading', { name: /Route not found/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Return to ATLAS Health/i })).toHaveAttribute('href', '/health');
  });
});
