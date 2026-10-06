import type { AtlasModuleDefinition } from '../registry';
import type { AtlasAuditSeverity } from './evolution';

export type AtlasDependencyNodeType = 'module' | 'route';

export type AtlasDependencyRelationship =
  | 'exposes'
  | 'depends-on'
  | 'reads'
  | 'writes'
  | 'supports'
  | 'triggers'
  | 'verifies';

export type AtlasDependencyEvidenceKind =
  | 'canonical-registry'
  | 'source-import'
  | 'runtime-trace'
  | 'workflow-contract'
  | 'provider-contract'
  | 'governed-declaration';

export type AtlasDependencyNode = {
  id: string;
  type: AtlasDependencyNodeType;
  label: string;
  canonicalRef: string;
};

export type AtlasDependencyEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationship: AtlasDependencyRelationship;
  evidence: {
    kind: AtlasDependencyEvidenceKind;
    reference: string;
  };
};

export type AtlasRuntimeDependencyCoverage = 'not-evaluated' | 'partial' | 'evaluated';

export type AtlasDependencyEcology = {
  nodes: readonly AtlasDependencyNode[];
  edges: readonly AtlasDependencyEdge[];
  coverage: {
    evaluatedRelationships: readonly AtlasDependencyRelationship[];
    runtimeDependencyCoverage: AtlasRuntimeDependencyCoverage;
  };
};

export type AtlasDependencyEcologyFinding = {
  id: string;
  code:
    | 'duplicate-dependency-node'
    | 'orphan-dependency-endpoint'
    | 'duplicate-dependency-edge'
    | 'conflicting-route-owner'
    | 'self-module-dependency'
    | 'dependency-cycle';
  severity: AtlasAuditSeverity;
  message: string;
  evidence: readonly string[];
};

export type AtlasDependencyEcologyValidation = {
  findings: readonly AtlasDependencyEcologyFinding[];
  blockingFindings: number;
  counts: Readonly<Record<AtlasAuditSeverity, number>>;
};

function registryModuleNode(module: AtlasModuleDefinition): AtlasDependencyNode {
  return {
    id: `module:${module.id}`,
    type: 'module',
    label: module.title,
    canonicalRef: module.id
  };
}

function registryRouteNode(route: string): AtlasDependencyNode {
  return {
    id: `route:${route}`,
    type: 'route',
    label: route,
    canonicalRef: route
  };
}

function registryExposeEdge(module: AtlasModuleDefinition): AtlasDependencyEdge {
  return {
    id: `exposes:${module.id}:${module.route}`,
    sourceNodeId: `module:${module.id}`,
    targetNodeId: `route:${module.route}`,
    relationship: 'exposes',
    evidence: {
      kind: 'canonical-registry',
      reference: `module=${module.id};route=${module.route}`
    }
  };
}

export function buildRegistryDependencyEcology(
  modules: readonly AtlasModuleDefinition[]
): AtlasDependencyEcology {
  const moduleNodes = modules.map(registryModuleNode);
  const routeNodes = Array.from(new Set(modules.map((module) => module.route)))
    .map(registryRouteNode);
  const edges = modules.map(registryExposeEdge);

  return {
    nodes: [...moduleNodes, ...routeNodes].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edges].sort((left, right) => left.id.localeCompare(right.id)),
    coverage: {
      evaluatedRelationships: ['exposes'],
      runtimeDependencyCoverage: 'not-evaluated'
    }
  };
}

function makeFinding(
  finding: AtlasDependencyEcologyFinding
): AtlasDependencyEcologyFinding {
  return finding;
}

function dependencyCycleKeys(
  graph: AtlasDependencyEcology,
  knownNodes: ReadonlySet<string>
): string[] {
  const adjacency = new Map<string, string[]>();

  for (const edge of graph.edges) {
    if (edge.relationship !== 'depends-on') continue;
    if (edge.sourceNodeId === edge.targetNodeId) continue;
    if (!knownNodes.has(edge.sourceNodeId) || !knownNodes.has(edge.targetNodeId)) continue;
    adjacency.set(edge.sourceNodeId, [
      ...(adjacency.get(edge.sourceNodeId) ?? []),
      edge.targetNodeId
    ]);
  }

  for (const [source, targets] of adjacency) {
    adjacency.set(source, [...new Set(targets)].sort());
  }

  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const cycles = new Set<string>();

  function visit(nodeId: string) {
    state.set(nodeId, 1);
    stack.push(nodeId);

    for (const targetId of adjacency.get(nodeId) ?? []) {
      const targetState = state.get(targetId) ?? 0;
      if (targetState === 0) {
        visit(targetId);
        continue;
      }
      if (targetState === 1) {
        const index = stack.lastIndexOf(targetId);
        if (index >= 0) {
          const cycleNodes = [...new Set(stack.slice(index))].sort();
          if (cycleNodes.length > 1) cycles.add(cycleNodes.join('|'));
        }
      }
    }

    stack.pop();
    state.set(nodeId, 2);
  }

  for (const nodeId of [...knownNodes].sort()) {
    if ((state.get(nodeId) ?? 0) === 0) visit(nodeId);
  }

  return [...cycles].sort();
}

export function validateDependencyEcology(
  graph: AtlasDependencyEcology
): AtlasDependencyEcologyValidation {
  const findings: AtlasDependencyEcologyFinding[] = [];
  const nodeCounts = new Map<string, number>();
  const edgeCounts = new Map<string, number>();

  for (const node of graph.nodes) {
    nodeCounts.set(node.id, (nodeCounts.get(node.id) ?? 0) + 1);
  }
  for (const edge of graph.edges) {
    edgeCounts.set(edge.id, (edgeCounts.get(edge.id) ?? 0) + 1);
  }

  for (const [nodeId, count] of nodeCounts) {
    if (count <= 1) continue;
    findings.push(makeFinding({
      id: `ecology:duplicate-node:${nodeId}`,
      code: 'duplicate-dependency-node',
      severity: 'P1',
      message: `Dependency node ${nodeId} is declared ${count} times.`,
      evidence: [`node occurrences=${count}`]
    }));
  }

  for (const [edgeId, count] of edgeCounts) {
    if (count <= 1) continue;
    findings.push(makeFinding({
      id: `ecology:duplicate-edge:${edgeId}`,
      code: 'duplicate-dependency-edge',
      severity: 'P2',
      message: `Dependency edge ${edgeId} is declared ${count} times.`,
      evidence: [`edge occurrences=${count}`]
    }));
  }

  const knownNodes = new Set(graph.nodes.map((node) => node.id));

  for (const edge of graph.edges) {
    const missing: string[] = [];
    if (!knownNodes.has(edge.sourceNodeId)) missing.push(`source=${edge.sourceNodeId}`);
    if (!knownNodes.has(edge.targetNodeId)) missing.push(`target=${edge.targetNodeId}`);
    if (!missing.length) continue;

    findings.push(makeFinding({
      id: `ecology:orphan-endpoint:${edge.id}`,
      code: 'orphan-dependency-endpoint',
      severity: 'P1',
      message: `Dependency edge ${edge.id} references a node that is not present in the graph.`,
      evidence: missing
    }));
  }

  const routeOwners = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (edge.relationship !== 'exposes') continue;
    const target = graph.nodes.find((node) => node.id === edge.targetNodeId);
    const source = graph.nodes.find((node) => node.id === edge.sourceNodeId);
    if (target?.type !== 'route' || source?.type !== 'module') continue;
    const owners = routeOwners.get(target.id) ?? new Set<string>();
    owners.add(source.id);
    routeOwners.set(target.id, owners);
  }

  for (const [routeNodeId, owners] of routeOwners) {
    if (owners.size <= 1) continue;
    findings.push(makeFinding({
      id: `ecology:conflicting-route-owner:${routeNodeId}`,
      code: 'conflicting-route-owner',
      severity: 'P1',
      message: `Canonical route ${routeNodeId} is exposed by multiple module owners.`,
      evidence: [...owners].sort()
    }));
  }

  for (const edge of graph.edges) {
    if (edge.relationship !== 'depends-on' || edge.sourceNodeId !== edge.targetNodeId) continue;
    findings.push(makeFinding({
      id: `ecology:self-dependency:${edge.id}`,
      code: 'self-module-dependency',
      severity: 'P1',
      message: `Dependency edge ${edge.id} makes a node depend on itself.`,
      evidence: [edge.sourceNodeId, edge.evidence.reference]
    }));
  }

  for (const cycleKey of dependencyCycleKeys(graph, knownNodes)) {
    findings.push(makeFinding({
      id: `ecology:dependency-cycle:${cycleKey}`,
      code: 'dependency-cycle',
      severity: 'P1',
      message: 'A module dependency cycle prevents a clean directional ownership chain.',
      evidence: cycleKey.split('|')
    }));
  }

  findings.sort((left, right) => left.id.localeCompare(right.id));

  const counts: Record<AtlasAuditSeverity, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const finding of findings) counts[finding.severity] += 1;

  return {
    findings,
    blockingFindings: counts.P0 + counts.P1,
    counts
  };
}
