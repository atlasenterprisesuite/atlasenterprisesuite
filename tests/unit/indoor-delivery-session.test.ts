import { describe, it, expect } from 'vitest';
import { advanceDeliveryStage, confirmDeliveryCheckpoint, createIndoorDeliverySession, getDeliveryIndoorRoute } from '../../apps/web/src/modules/gps/indoorDeliverySession';
import type { IndoorBuilding } from '../../apps/web/src/modules/gps/immersiveSpatial';

const building: IndoorBuilding = {
  id: 'building-1', label: 'Verified test building', organization_id: 'tenant-a', source: 'atlas',
  center: { lat: 0, lon: 0, label: 'Fixture' },
  levels: [{ id: 'L', label: 'Lobby', elevation_m: 0 }, { id: '2', label: 'Level 2', elevation_m: 3 }],
  entranceNodeIds: ['gate'],
  nodes: [
    { id: 'gate', kind: 'entrance', label: 'Entrance', position: { x_m: 0, y_m: 0, z_m: 0, level: 'L' }, connectsTo: ['lift'] },
    { id: 'lift', kind: 'elevator', label: 'Elevator', position: { x_m: 3, y_m: 0, z_m: 0, level: 'L' }, connectsTo: ['gate', 'hall'] },
    { id: 'hall', kind: 'corridor', label: 'Hallway', position: { x_m: 3, y_m: 0, z_m: 3, level: '2' }, connectsTo: ['lift', 'unit'] },
    { id: 'unit', kind: 'room', label: 'Unit', position: { x_m: 6, y_m: 0, z_m: 3, level: '2' }, connectsTo: ['hall'] }
  ]
};
const session = createIndoorDeliverySession({ organizationId: 'tenant-a', orderId: 'order-a', driverId: 'driver-a', buildingId: 'building-1', destinationNodeId: 'unit' });

describe('ATLAS indoor delivery fail-closed session', () => {
  it('rejects missing identity and out-of-order transitions', () => {
    expect(() => createIndoorDeliverySession({ organizationId: '', orderId: 'o', driverId: 'd', buildingId: 'b', destinationNodeId: 'u' })).toThrow();
    expect(() => advanceDeliveryStage(session, 'delivered', 1)).toThrow('invalid_delivery_stage');
  });
  it('refuses routes without a confirmed position', () => {
    expect(getDeliveryIndoorRoute(session, building)).toMatchObject({ state: 'blocked', reason: 'position_unconfirmed' });
  });
  it('refuses cross-tenant buildings and unknown checkpoints', () => {
    const other = { ...building, organization_id: 'tenant-b' };
    expect(getDeliveryIndoorRoute(session, other)).toMatchObject({ state: 'blocked', reason: 'building_scope_mismatch' });
    expect(() => confirmDeliveryCheckpoint(session, other, { nodeId: 'gate', source: 'manual-confirmation', confirmedAt: 1 })).toThrow();
    expect(() => confirmDeliveryCheckpoint(session, building, { nodeId: 'missing', source: 'manual-confirmation', confirmedAt: 1 })).toThrow();
  });
  it('computes a verified graph route from an explicitly confirmed checkpoint', () => {
    const positioned = confirmDeliveryCheckpoint(session, building, { nodeId: 'gate', source: 'manual-confirmation', confirmedAt: 1 });
    const route = getDeliveryIndoorRoute(positioned, building);
    expect(route.state).toBe('ready');
    expect(route.nodes.map(node => node.id)).toEqual(['gate','lift','hall','unit']);
  });
  it('requires confirmed destination before marking completion', () => {
    let current = session;
    for (const next of ['picked-up','at-gate','inside-building','at-unit'] as const)
      current = advanceDeliveryStage(current, next, 100);
    expect(() => advanceDeliveryStage(current, 'delivered', 200)).toThrow('destination_not_confirmed');
    current = confirmDeliveryCheckpoint(current, building, { nodeId: 'unit', source: 'verified-checkpoint', confirmedAt: 150 });
    expect(advanceDeliveryStage(current, 'delivered', 200).completedAt).toBe(200);
  });
});
