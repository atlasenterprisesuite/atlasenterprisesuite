import type { EvidenceRecord, GraphEdge, GraphNode, ValidationResult } from '../types';

export function validateGraph(nodes: GraphNode[], edges: GraphEdge[], evidence: EvidenceRecord[]): ValidationResult {
  const errors: string[] = [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const evidenceIds = new Set(evidence.map((record) => record.id));

  for (const node of nodes) {
    if (node.confidence < 0 || node.confidence > 1) errors.push(`node ${node.id} confidence must be between 0 and 1`);
    for (const evidenceId of node.evidenceRecordIds) {
      if (!evidenceIds.has(evidenceId)) errors.push(`node ${node.id} references missing evidence ${evidenceId}`);
    }
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId)) errors.push(`edge ${edge.id} references missing source node ${edge.sourceNodeId}`);
    if (!nodeIds.has(edge.targetNodeId)) errors.push(`edge ${edge.id} references missing target node ${edge.targetNodeId}`);
    if (edge.confidence < 0 || edge.confidence > 1) errors.push(`edge ${edge.id} confidence must be between 0 and 1`);
    for (const evidenceId of edge.evidenceRecordIds) {
      if (!evidenceIds.has(evidenceId)) errors.push(`edge ${edge.id} references missing evidence ${evidenceId}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function graphForDisease(diseaseId: string, nodes: GraphNode[], edges: GraphEdge[]) {
  const filteredNodes = nodes.filter((node) => node.diseaseIds.includes(diseaseId));
  const ids = new Set(filteredNodes.map((node) => node.id));
  return {
    nodes: filteredNodes,
    edges: edges.filter((edge) => ids.has(edge.sourceNodeId) && ids.has(edge.targetNodeId))
  };
}
