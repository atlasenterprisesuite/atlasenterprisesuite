import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { EvidenceRecord, GraphEdge, GraphNode } from '../../../../packages/health/types';
import { NeuralGraphPanel } from './NeuralGraphPanel';

const evidence: EvidenceRecord[] = [{
  id: 'ev-1', diseaseIds: ['hiv'], title: 'Supporting reservoir evidence', sourceType: 'demo', sourceName: 'ATLAS demo',
  sourceIdentifier: 'atlas-demo://graph/support', publicationDate: '2026-09-03', evidenceLevel: 'hypothesis',
  studyDesign: 'demo', populationOrModel: 'No biological model', sampleSize: null, finding: 'Demo support only.',
  limitations: ['Synthetic demonstration content.'], safetySignals: [], replicationStatus: 'unreplicated',
  regulatoryStatus: 'not_applicable', confidence: 0.1, status: 'active', demo: true
}];

const nodes: GraphNode[] = [
  { id: 'seed', type: 'seed', label: 'Seed', description: 'Residual state.', diseaseIds: ['hiv'], evidenceRecordIds: ['ev-1'], confidence: 0.1, status: 'active' },
  { id: 'niche', type: 'niche', label: 'Niche', description: 'Protected state.', diseaseIds: ['hiv'], evidenceRecordIds: ['ev-1'], confidence: 0.1, status: 'active' }
];

const edges: GraphEdge[] = [{
  id: 'edge-1', sourceNodeId: 'seed', targetNodeId: 'niche', relationType: 'persists_in', direction: 'forward',
  evidenceRecordIds: ['ev-1'], confidence: 0.1, status: 'active', falsificationNotes: ['Demo relationship; not a causal claim.']
}];

describe('NeuralGraphPanel inspection', () => {
  it('allows an edge to be selected and exposes its supporting evidence and falsification notes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NeuralGraphPanel nodes={nodes} edges={edges} evidence={evidence} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /seed persists in niche/i }));
    expect(screen.getByRole('heading', { name: /persists in/i })).toBeInTheDocument();
    expect(screen.getByText('Supporting reservoir evidence')).toBeInTheDocument();
    expect(screen.getByText(/Demo relationship; not a causal claim/i)).toBeInTheDocument();
  });
});
