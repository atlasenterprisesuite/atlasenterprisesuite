import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AtlasShell } from './AtlasShell';
import { LabNav } from './LabNav';
import { NeuralGraphPanel } from './NeuralGraphPanel';
import { ResearchBadge } from './ResearchBadge';

const nodes = [{ id: 'n1', type: 'seed', label: 'Reservoir seed', description: 'Demo node', diseaseIds: ['hiv'], evidenceRecordIds: ['e1'], confidence: 0.8, status: 'supported' }] as const;
const edges = [] as const;
const evidence = [{ id: 'e1', diseaseIds: ['hiv'], title: 'Demo evidence', sourceName: 'ATLAS demo registry', sourceIdentifier: 'DEMO-1', evidenceLevel: 'human', status: 'active', finding: 'Demo finding', limitations: ['Demo only'], safetySignals: [], replicationStatus: 'demo' }] as const;

test('shell exposes skip navigation and the real Health route', () => {
  render(<MemoryRouter><AtlasShell><div>content</div></AtlasShell></MemoryRouter>);
  expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#atlas-main');
  expect(screen.getByRole('link', { name: /^health$/i })).toHaveAttribute('href', '/health');
});

test('research components expose real information and routes', () => {
  render(
    <MemoryRouter>
      <LabNav />
      <ResearchBadge />
      <NeuralGraphPanel nodes={[...nodes]} edges={[...edges]} evidence={[...evidence]} />
    </MemoryRouter>
  );
  expect(screen.getByText(/research.*demo/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /evidence registry/i })).toHaveAttribute('href', expect.stringContaining('/evidence'));
  expect(screen.getByText('Reservoir seed')).toBeInTheDocument();
});
