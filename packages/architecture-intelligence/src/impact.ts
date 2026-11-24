import type {
  DependencyGraph,
  DependencyRisk,
  ImpactExplanation,
  ImpactReport,
  UnresolvedDependency,
  VerificationRequirement
} from './types';

const RISK_WEIGHT: Record<DependencyRisk, number> = {
  P2: 0,
  P1: 1,
  P0: 2
};

function strongestRisk(risks: readonly DependencyRisk[]): DependencyRisk {
  return risks.reduce<DependencyRisk>(
    (current, risk) => (RISK_WEIGHT[risk] > RISK_WEIGHT[current] ? risk : current),
    'P2'
  );
}

function dedupeVerification(
  requirements: readonly VerificationRequirement[]
): VerificationRequirement[] {
  const byId = new Map<string, VerificationRequirement>();
  for (const requirement of requirements) {
    if (!byId.has(requirement.id)) byId.set(requirement.id, requirement);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function analyzeDependencyImpact(input: {
  graph: DependencyGraph;
  changedNodeIds: readonly string[];
  unresolved?: readonly UnresolvedDependency[];
  globalVerification?: readonly VerificationRequirement[];
}): ImpactReport {
  const nodeMap = new Map(input.graph.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, string[]>();

  for (const edge of input.graph.edges) {
    const targets = adjacency.get(edge.from) ?? [];
    if (!targets.includes(edge.to)) targets.push(edge.to);
    adjacency.set(edge.from, targets);
  }

  for (const changedId of input.changedNodeIds) {
    if (!nodeMap.has(changedId)) throw new Error(`unknown_changed_node:${changedId}`);
  }

  const changedSet = new Set(input.changedNodeIds);
  const direct: string[] = [];
  const directSet = new Set<string>();
  for (const changedId of input.changedNodeIds) {
    for (const target of adjacency.get(changedId) ?? []) {
      if (changedSet.has(target) || directSet.has(target)) continue;
      directSet.add(target);
      direct.push(target);
    }
  }

  const visited = new Set(input.changedNodeIds);
  const paths = new Map<string, string[]>();
  const queue: string[] = [];

  for (const changedId of input.changedNodeIds) {
    for (const target of adjacency.get(changedId) ?? []) {
      if (visited.has(target)) continue;
      visited.add(target);
      paths.set(target, [changedId, target]);
      queue.push(target);
    }
  }

  const transitive: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentPath = paths.get(current) ?? [current];

    for (const target of adjacency.get(current) ?? []) {
      if (visited.has(target)) continue;
      visited.add(target);
      paths.set(target, [...currentPath, target]);
      queue.push(target);
      if (!directSet.has(target)) transitive.push(target);
    }
  }

  const affectedIds = [...input.changedNodeIds, ...direct, ...transitive];
  const unresolved = [...(input.unresolved ?? [])];
  const risk = strongestRisk([
    ...affectedIds.map((id) => nodeMap.get(id)?.risk ?? 'P2'),
    ...unresolved.map((item) => item.risk)
  ]);

  const requiredVerification = dedupeVerification([
    ...(input.globalVerification ?? []),
    ...affectedIds.flatMap((id) => nodeMap.get(id)?.verification ?? [])
  ]);

  const explanations: ImpactExplanation[] = [...direct, ...transitive].map((targetId) => ({
    targetId,
    path: paths.get(targetId) ?? [targetId]
  }));

  const recommendation = unresolved.some((item) => item.risk === 'P0')
    ? 'HOLD_UNKNOWN_DEPENDENCY'
    : unresolved.length > 0
      ? 'CLEAR_WITH_WARNINGS'
      : 'CLEAR';

  return {
    risk,
    direct,
    transitive,
    requiredVerification,
    unresolved,
    explanations,
    recommendation
  };
}
