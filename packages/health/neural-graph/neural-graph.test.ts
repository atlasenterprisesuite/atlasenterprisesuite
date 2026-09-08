import { describe, expect, it } from 'vitest';
import { validateGraph } from './index';
import type { EvidenceRecord, GraphEdge, GraphNode } from '../types';

const evidence: EvidenceRecord[] = [{
  id: 'ev-1', diseaseIds: ['hiv'], title: 'Reservoir study', sourceType: 'journal', sourceName: 'Journal',
  sourceIdentifier: 'doi:10.example/graph', publicationDate: '2026-08-01', evidenceLevel: 'human_observational',
  studyDesign: 'cohort', populationOrModel: 'Adults', sampleSize: 50, finding: 'Reservoir persistence observed.',
  limitations: ['Observational.'], safetySignals: [], replicationStatus: 'unreplicated', regulatoryStatus: 'not_applicable',
  confidence: 0.7, status: 'active', demo: true
}];

const nodes: GraphNode[] = [
  { id: 'seed', type: 'seed', label: 'Rebound-competent seed', description: 'Residual state able to reconstruct viremia.', diseaseIds: ['hiv'], evidenceRecordIds: ['ev-1'], confidence: 0.7, status: 'supported' },
  { id: 'niche', type: 'niche', label: 'Protected niche', description: 'Anatomical protection.', diseaseIds: ['hiv'], evidenceRecordIds: ['ev-1'], confidence: 0.6, status: 'active' }
];

const edges: GraphEdge[] = [
  { id: 'edge-1', sourceNodeId: 'seed', targetNodeId: 'niche', relationType: 'persists_in', direction: 'forward', evidenceRecordIds: ['ev-1'], confidence: 0.65, status: 'supported', falsificationNotes: [] }
];

describe('Neural Graph integrity', () => {
  it('accepts a graph when every node, edge and evidence reference resolves', () => {
    expect(validateGraph(nodes, edges, evidence)).toEqual({ valid: true, errors: [] });
  });

  it('rejects orphan edge endpoints and missing evidence references', () => {
    const brokenEdges: GraphEdge[] = [{ ...edges[0], targetNodeId: 'missing-node', evidenceRecordIds: ['missing-evidence'] }];
    const result = validateGraph(nodes, brokenEdges, evidence);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'edge edge-1 references missing target node missing-node',
      'edge edge-1 references missing evidence missing-evidence'
    ]));
  });
});
