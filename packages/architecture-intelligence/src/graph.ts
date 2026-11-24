import type {
  DependencyEdge,
  DependencyGraph,
  DependencyNode
} from './types';

const SENSITIVE_KEY = /(?:api.?key|token|password|credential|authorization|private.?key|secret)/i;
const SECRET_VALUE = /^(?:Bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}|gh[opusr]_[A-Za-z0-9_]{8,})/i;
const SECRET_NAME = /^[A-Z][A-Z0-9_]*$/;

function inspectMetadata(value: unknown, key = ''): void {
  if (typeof value === 'string') {
    if (key === 'secretName' && SECRET_NAME.test(value)) return;
    if ((SENSITIVE_KEY.test(key) && value.trim()) || SECRET_VALUE.test(value.trim())) {
      throw new Error(`secret_value_forbidden:${key || 'value'}`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => inspectMetadata(item, key));
    return;
  }

  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
      inspectMetadata(childValue, childKey);
    });
  }
}

export function validateSafeMetadata(metadata: Record<string, unknown>): void {
  inspectMetadata(metadata);
}

export function buildDependencyGraph(input: {
  nodes: readonly DependencyNode[];
  edges: readonly DependencyEdge[];
}): DependencyGraph {
  const nodeMap = new Map<string, DependencyNode>();

  for (const node of input.nodes) {
    if (!node.id.trim()) throw new Error('dependency_node_id_required');
    if (node.metadata) validateSafeMetadata(node.metadata);

    const existing = nodeMap.get(node.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(node)) {
      throw new Error(`dependency_node_conflict:${node.id}`);
    }
    if (!existing) nodeMap.set(node.id, node);
  }

  const edgeKeys = new Set<string>();
  const edges: DependencyEdge[] = [];

  for (const edge of input.edges) {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) {
      throw new Error(`dependency_edge_unknown_node:${edge.from}->${edge.to}`);
    }
    const key = `${edge.from}|${edge.to}|${edge.kind}|${edge.provenance}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push(edge);
  }

  return {
    nodes: [...nodeMap.values()],
    edges
  };
}
