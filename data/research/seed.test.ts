import { describe, expect, it } from 'vitest';
import { validateEvidenceRecord } from '../../packages/health/evidence';
import { validateGraph } from '../../packages/health/neural-graph';
import { diseases, evidenceRecords, graphEdges, graphNodes } from './seed';

describe('ATLAS governed demo research dataset', () => {
  it('contains only provenance-valid explicitly synthetic evidence records', () => {
    for (const record of evidenceRecords) {
      expect(validateEvidenceRecord(record), record.id).toEqual({ valid: true, errors: [] });
      expect(record.demo, record.id).toBe(true);
      expect(record.sourceType, record.id).toBe('demo');
      expect(record.evidenceLevel, record.id).toBe('hypothesis');
      expect(record.sourceIdentifier, record.id).toMatch(/^atlas-demo:\/\//);
    }
  });

  it('keeps disease identifiers and slugs unique', () => {
    expect(new Set(diseases.map((disease) => disease.id)).size).toBe(diseases.length);
    expect(new Set(diseases.map((disease) => disease.slug)).size).toBe(diseases.length);
  });

  it('ships a graph whose node, edge and evidence references all resolve', () => {
    expect(validateGraph(graphNodes, graphEdges, evidenceRecords)).toEqual({ valid: true, errors: [] });
  });
});
