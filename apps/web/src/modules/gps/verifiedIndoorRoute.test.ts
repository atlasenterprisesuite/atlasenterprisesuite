import { describe, expect, it } from 'vitest';
import { findEvidenceGatedIndoorRoute, type VerifiedIndoorEdge } from './verifiedIndoorRoute';
import type { IndoorBuilding } from './immersiveSpatial';

const building: IndoorBuilding = {
  id: 'test-building', label: 'Synthetic building', organization_id: 'org-a',
  source: 'atlas', center: { lat: 0, lon: 0, label: 'Synthetic' },
  levels: [{ id: 'L1', label: 'Level 1', elevation_m: 0 }],
  entranceNodeIds: ['a'],
  nodes: [
    { id: 'a', label: 'A', kind: 'entrance', position: { x_m: 0, y_m: 0, z_m: 0, level: 'L1' }, connectsTo: ['b'], accessible: true },
    { id: 'b', label: 'B', kind: 'corridor', position: { x_m: 1, y_m: 0, z_m: 0, level: 'L1' }, connectsTo: ['c'], accessible: true },
    { id: 'c', label: 'C', kind: 'poi', position: { x_m: 2, y_m: 0, z_m: 0, level: 'L1' }, connectsTo: [], accessible: true }
  ]
};
const edge = (fromNodeId: string, toNodeId: string): VerifiedIndoorEdge => ({
  fromNodeId, toNodeId, organizationId: 'org-a', buildingId: 'test-building',
  evidenceRef: 'synthetic-evidence', status: 'verified', accessible: true
});
const route = (edges: VerifiedIndoorEdge[], org = 'org-a', accessible = false) =>
  findEvidenceGatedIndoorRoute(building, 'a', 'c', org, edges, accessible);

describe('verified indoor navigation fail-closed contract', () => {
  it('rejects routes with no evidence or a missing intermediate edge', () => {
    expect(route([])).toEqual([]);
    expect(route([edge('a', 'b')])).toEqual([]);
  });
  it('rejects unverified, revoked, mismatched tenant/building, empty evidence and reverse-only links', () => {
    const good = edge('a', 'b');
    for (const bad of [
      { ...edge('b', 'c'), status: 'unverified' as const },
      { ...edge('b', 'c'), status: 'revoked' as const },
      { ...edge('b', 'c'), organizationId: 'org-b' },
      { ...edge('b', 'c'), buildingId: 'other' },
      { ...edge('b', 'c'), evidenceRef: ' ' },
      edge('c', 'b')
    ]) expect(route([good, bad])).toEqual([]);
    expect(route([good, edge('b', 'c')], 'org-b')).toEqual([]);
  });
  it('requires accessible edges and nodes when accessibility is requested', () => {
    expect(route([edge('a', 'b'), { ...edge('b', 'c'), accessible: false }], 'org-a', true)).toEqual([]);
    expect(route([edge('a', 'b'), edge('b', 'c')], 'org-a', true).map(n => n.id)).toEqual(['a', 'b', 'c']);
  });
  it('accepts only a complete directed synthetic evidence chain', () => {
    expect(route([edge('a', 'b'), edge('b', 'c')]).map(n => n.id)).toEqual(['a', 'b', 'c']);
  });
});
