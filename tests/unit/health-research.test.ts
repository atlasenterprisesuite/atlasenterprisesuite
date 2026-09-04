import { describe, expect, it } from 'vitest';
import { curabilityDefinitions } from '../../packages/health/curability';
import { graphForDisease, validateGraph } from '../../packages/health/neural-graph';
import { calculateVulnerability } from '../../packages/health/reconstruction';
import { diseases, evidenceRecords, graphEdges, graphNodes, vulnerabilityProfiles } from '../../data/research/seed';

describe('ATLAS Health research domain', () => {
  it('keeps the governed demo graph internally valid', () => {
    const result = validateGraph(graphNodes, graphEdges, evidenceRecords);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('filters disease graph nodes without leaking unrelated nodes', () => {
    const graph = graphForDisease('hiv', graphNodes, graphEdges);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.nodes.every((node) => node.diseaseIds.includes('hiv'))).toBe(true);
    expect(graph.edges.every((edge) => edge.sourceNodeId.startsWith('hiv-') && edge.targetNodeId.startsWith('hiv-'))).toBe(true);
  });

  it('returns a bounded deterministic vulnerability score', () => {
    const first = calculateVulnerability(vulnerabilityProfiles.hiv);
    const second = calculateVulnerability(vulnerabilityProfiles.hiv);
    expect(first).toEqual(second);
    expect(first.reconstructionRisk).toBeGreaterThanOrEqual(0);
    expect(first.reconstructionRisk).toBeLessThanOrEqual(100);
    expect(first.formulaVersion).toBe('v1');
  });

  it('keeps cure-level claims explicitly defined and evidence-gated in the UI contract', () => {
    expect(Object.keys(curabilityDefinitions)).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']);
    expect(curabilityDefinitions.C5).toMatch(/Reproducible individual cure/i);
    expect(diseases.length).toBe(6);
  });
});
