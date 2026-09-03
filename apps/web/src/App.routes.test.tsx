import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AppRoutes } from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );
}

afterEach(() => cleanup());

const supportedRoutes = [
  ['/', 'One governed ecosystem'],
  ['/health', 'ATLAS Health'],
  ['/health/research', 'Research & Innovation'],
  ['/health/research/frontiers', 'Health Frontiers'],
  ['/health/research/frontiers/disease-reconstruction', 'Disease Reconstruction Lab'],
  ['/health/research/frontiers/disease-reconstruction/diseases', 'Diseases'],
  ['/health/research/frontiers/disease-reconstruction/diseases/hiv', 'HIV'],
  ['/health/research/frontiers/disease-reconstruction/neural-graph', 'Neural Graph'],
  ['/health/research/frontiers/disease-reconstruction/evidence', 'Evidence Registry'],
  ['/health/research/frontiers/disease-reconstruction/falsification', 'Falsification Engine'],
  ['/health/research/frontiers/disease-reconstruction/vulnerability', 'Reconstruction Vulnerability Engine'],
  ['/health/research/frontiers/disease-reconstruction/curability', 'Curability Index'],
  ['/health/research/frontiers/disease-reconstruction/updates', 'Research Updates'],
  ['/health/research/frontiers/disease-reconstruction/settings', 'Settings']
] as const;

describe('supported ATLAS Health route matrix', () => {
  for (const [path, heading] of supportedRoutes) {
    it(`renders ${path} without falling into not-found state`, () => {
      renderAt(path);
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Route not found/i })).not.toBeInTheDocument();
    });
  }
});
