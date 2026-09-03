import { curabilityDefinitions } from '../../../packages/health/curability';
import { evidenceLabel } from '../../../packages/health/evidence';
import { graphForDisease, validateGraph } from '../../../packages/health/neural-graph';
import { calculateVulnerability } from '../../../packages/health/reconstruction';
import {
  demoDataNotice,
  diseases,
  evidenceRecords,
  graphEdges,
  graphNodes,
  vulnerabilityProfiles
} from '../../../data/research/seed';

test('demo dataset is explicitly non-production', () => {
  expect(demoDataNotice.toLowerCase()).toContain('demo');
  expect(demoDataNotice.toLowerCase()).toContain('research');
  expect(diseases.length).toBeGreaterThan(0);
});

test('demo graph has valid node and evidence references', () => {
  expect(validateGraph(graphNodes, graphEdges, evidenceRecords)).toEqual({ valid: true, errors: [] });
  expect(graphForDisease('hiv', graphNodes, graphEdges).nodes.length).toBeGreaterThan(0);
});

test('vulnerability calculation is deterministic and bounded', () => {
  const result = calculateVulnerability(vulnerabilityProfiles.hiv);
  expect(result.formulaVersion).toBe('v1');
  expect(result.reconstructionRisk).toBeGreaterThanOrEqual(0);
  expect(result.reconstructionRisk).toBeLessThanOrEqual(100);
  expect(calculateVulnerability(vulnerabilityProfiles.hiv)).toEqual(result);
});

test('evidence and curability labels remain explicit', () => {
  expect(evidenceLabel('human')).toBe('Human evidence');
  expect(curabilityDefinitions.C5).toMatch(/reproducible/i);
  expect(curabilityDefinitions.C7).toMatch(/eradication/i);
});
