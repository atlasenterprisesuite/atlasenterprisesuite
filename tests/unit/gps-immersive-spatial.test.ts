import { describe, expect, it } from 'vitest';
import {
  findIndoorRoute,
  resolveSpatialMode,
  validateIndoorBuilding,
  type IndoorBuilding
} from '../../apps/web/src/modules/gps/immersiveSpatial';

const building: IndoorBuilding = {
  id: 'atlas-demo-building',
  label: 'ATLAS Demo Building',
  organization_id: 'org-demo',
  source: 'atlas',
  center: { lat: 28.5384, lon: -81.3789, label: 'ATLAS Demo Building' },
  levels: [
    { id: '0', label: 'Ground', elevation_m: 0 },
    { id: '1', label: 'Level 1', elevation_m: 4 }
  ],
  entranceNodeIds: ['entrance'],
  nodes: [
    {
      id: 'entrance',
      label: 'Main entrance',
      kind: 'entrance',
      position: { x_m: 0, y_m: 0, z_m: 0, level: '0' },
      connectsTo: ['lobby'],
      accessible: true
    },
    {
      id: 'lobby',
      label: 'Lobby',
      kind: 'corridor',
      position: { x_m: 8, y_m: 0, z_m: 0, level: '0' },
      connectsTo: ['entrance', 'elevator'],
      accessible: true
    },
    {
      id: 'elevator',
      label: 'Elevator',
      kind: 'elevator',
      position: { x_m: 12, y_m: 0, z_m: 0, level: '0' },
      connectsTo: ['lobby', 'elevator-l1'],
      accessible: true
    },
    {
      id: 'elevator-l1',
      label: 'Elevator L1',
      kind: 'elevator',
      position: { x_m: 12, y_m: 0, z_m: 4, level: '1' },
      connectsTo: ['elevator', 'suite'],
      accessible: true
    },
    {
      id: 'suite',
      label: 'Suite 101',
      kind: 'room',
      position: { x_m: 22, y_m: 4, z_m: 4, level: '1' },
      connectsTo: ['elevator-l1'],
      accessible: true
    }
  ]
};

describe('ATLAS GPS immersive spatial domain', () => {
  it('fails closed when photorealistic imagery is not configured', () => {
    const decision = resolveSpatialMode('photorealistic-3d', {
      googlePhotorealisticConfigured: false,
      streetPanoramaConfigured: false,
      openIndoorConfigured: false,
      tenantIndoorAvailable: false
    });

    expect(decision.state).toBe('blocked');
    expect(decision.resolved).toBe('open-3d');
    expect(decision.provider).toBe('atlas-open-3d');
  });

  it('does not claim indoor mode without an authorized indoor source', () => {
    const decision = resolveSpatialMode('indoor', {
      googlePhotorealisticConfigured: true,
      streetPanoramaConfigured: true,
      openIndoorConfigured: false,
      tenantIndoorAvailable: false
    });

    expect(decision.state).toBe('blocked');
    expect(decision.resolved).toBe('open-3d');
  });

  it('validates an indoor building graph and routes across floors', () => {
    expect(validateIndoorBuilding(building)).toEqual({ ok: true });
    expect(findIndoorRoute(building, 'entrance', 'suite').map((node) => node.id)).toEqual([
      'entrance',
      'lobby',
      'elevator',
      'elevator-l1',
      'suite'
    ]);
  });

  it('returns no route for invalid node ids', () => {
    expect(findIndoorRoute(building, 'entrance', 'missing')).toEqual([]);
  });
});
