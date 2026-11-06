import { validateIndoorBuilding, type IndoorBuilding, type IndoorNode } from './immersiveSpatial';

/** Evidence records must be verified by a trusted service before reaching this client. */
export type VerifiedIndoorEdge = {
  organizationId: string;
  buildingId: string;
  fromNodeId: string;
  toNodeId: string;
  evidenceRef: string;
  status: 'verified' | 'unverified' | 'simulation' | 'revoked';
  accessible: boolean;
};

/** Directed edges are intentional; reverse traversal requires its own evidence. */
export function findEvidenceGatedIndoorRoute(
  building: IndoorBuilding,
  fromNodeId: string,
  toNodeId: string,
  activeOrganizationId: string,
  edges: readonly VerifiedIndoorEdge[],
  accessibleOnly = false
): IndoorNode[] {
  if (!activeOrganizationId || building.organization_id !== activeOrganizationId) return [];
  if (!validateIndoorBuilding(building).ok || !fromNodeId || !toNodeId) return [];
  const byId = new Map(building.nodes.map(node => [node.id, node]));
  if (!byId.has(fromNodeId) || !byId.has(toNodeId)) return [];
  if (accessibleOnly && (byId.get(fromNodeId)?.accessible !== true || byId.get(toNodeId)?.accessible !== true)) return [];

  const verified = new Set(
    edges.filter(edge =>
      edge.organizationId === activeOrganizationId &&
      edge.buildingId === building.id &&
      edge.status === 'verified' &&
      typeof edge.evidenceRef === 'string' &&
      edge.evidenceRef.trim().length > 0 &&
      (!accessibleOnly || edge.accessible === true)
    ).map(edge => JSON.stringify([edge.fromNodeId, edge.toNodeId]))
  );

  const queue = [fromNodeId];
  const previous = new Map<string, string | null>([[fromNodeId, null]]);
  while (queue.length) {
    const currentId = queue.shift()!;
    if (currentId === toNodeId) break;
    const current = byId.get(currentId)!;
    for (const nextId of current.connectsTo) {
      if (previous.has(nextId) || !verified.has(JSON.stringify([currentId, nextId]))) continue;
      const next = byId.get(nextId);
      if (!next || (accessibleOnly && next.accessible !== true)) continue;
      previous.set(nextId, currentId);
      queue.push(nextId);
    }
  }
  if (!previous.has(toNodeId)) return [];
  const result: IndoorNode[] = [];
  let cursor: string | null = toNodeId;
  while (cursor) {
    const node = byId.get(cursor);
    if (!node) return [];
    result.push(node);
    cursor = previous.get(cursor) ?? null;
  }
  return result.reverse();
}
