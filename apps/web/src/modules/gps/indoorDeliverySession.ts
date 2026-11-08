import { findIndoorRoute, validateIndoorBuilding, type IndoorBuilding, type IndoorNode } from './immersiveSpatial';

export type DeliveryStage = 'assigned' | 'picked-up' | 'at-gate' | 'inside-building' | 'at-unit' | 'delivered';
export type DeliveryPosition = { nodeId: string; source: 'verified-checkpoint' | 'manual-confirmation'; confirmedAt: number };
export type IndoorDeliverySession = {
  organizationId: string;
  orderId: string;
  buildingId: string;
  destinationNodeId: string;
  driverId: string;
  stage: DeliveryStage;
  position: DeliveryPosition | null;
  completedAt: number | null;
};

const stages: readonly DeliveryStage[] = ['assigned','picked-up','at-gate','inside-building','at-unit','delivered'];

export function createIndoorDeliverySession(input: {
  organizationId: string; orderId: string; buildingId: string; destinationNodeId: string; driverId: string;
}): IndoorDeliverySession {
  if (Object.values(input).some((value) => !value.trim())) throw new Error('delivery_identity_required');
  return { ...input, stage: 'assigned', position: null, completedAt: null };
}

export function advanceDeliveryStage(session: IndoorDeliverySession, next: DeliveryStage, now: number): IndoorDeliverySession {
  if (!Number.isFinite(now) || now <= 0) throw new Error('invalid_event_time');
  const currentIndex = stages.indexOf(session.stage);
  const nextIndex = stages.indexOf(next);
  if (nextIndex !== currentIndex + 1) throw new Error('invalid_delivery_stage');
  if (next === 'delivered' && (!session.position || session.position.nodeId !== session.destinationNodeId))
    throw new Error('destination_not_confirmed');
  return { ...session, stage: next, completedAt: next === 'delivered' ? now : null };
}

export function confirmDeliveryCheckpoint(
  session: IndoorDeliverySession,
  building: IndoorBuilding,
  position: DeliveryPosition
): IndoorDeliverySession {
  if (session.stage === 'delivered') throw new Error('delivery_session_closed');
  if (building.id !== session.buildingId || building.organization_id !== session.organizationId)
    throw new Error('building_scope_mismatch');
  if (!validateIndoorBuilding(building).ok) throw new Error('indoor_model_unverified');
  if (!Number.isFinite(position.confirmedAt) || position.confirmedAt <= 0) throw new Error('invalid_checkpoint_time');
  if (!building.nodes.some((node) => node.id === position.nodeId)) throw new Error('unknown_checkpoint');
  return { ...session, position };
}

export function getDeliveryIndoorRoute(
  session: IndoorDeliverySession,
  building: IndoorBuilding,
  accessibleOnly = false
): { state: 'ready'; nodes: IndoorNode[] } | { state: 'blocked'; reason: string; nodes: [] } {
  const deny = (reason: string) => ({ state: 'blocked' as const, reason, nodes: [] as [] });
  if (session.stage === 'delivered') return deny('delivery_session_closed');
  if (building.id !== session.buildingId || building.organization_id !== session.organizationId)
    return deny('building_scope_mismatch');
  if (!validateIndoorBuilding(building).ok) return deny('indoor_model_unverified');
  if (!session.position) return deny('position_unconfirmed');
  if (!building.nodes.some((node) => node.id === session.destinationNodeId && node.kind === 'room'))
    return deny('destination_unverified');
  const nodes = findIndoorRoute(building, session.position.nodeId, session.destinationNodeId, accessibleOnly);
  if (!nodes.length) return deny('route_unavailable');
  return { state: 'ready', nodes };
}
