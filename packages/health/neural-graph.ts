import type { EvidenceRecord, GraphEdge, GraphNode } from './types';

export function graphForDisease(diseaseId: string, nodes: GraphNode[], edges: GraphEdge[]) {
  const filteredNodes = nodes.filter((node) => node.diseaseIds.includes(diseaseId));
  const nodeIds = new Set(filteredNodes.map((node) => node.id));
  return {
    nodes: filteredNodes,
    edges: edges.filter((edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId))
  };
}

export function validateGraph(nodes: GraphNode[], edges: GraphEdge[], evidence: EvidenceRecord[]) {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  const evidenceIds = new Set(evidence.map((record) => record.id));

  for (const node of nodes) {
    if (nodeIds.has(node.id)) errors.push(`Duplicate node: ${node.id}`);
    nodeIds.add(node.id);
    for (const evidenceId of node.evidenceRecordIds) {
      if (!evidenceIds.has(evidenceId)) errors.push(`Missing evidence ${evidenceId} for node ${node.id}`);
    }
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId)) errors.push(`Missing source node ${edge.sourceNodeId}`);
    if (!nodeIds.has(edge.targetNodeId)) errors.push(`Missing target node ${edge.targetNodeId}`);
    for (const evidenceId of edge.evidenceRecordIds) {
      if (!evidenceIds.has(evidenceId)) errors.push(`Missing evidence ${evidenceId} for edge ${edge.id}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
