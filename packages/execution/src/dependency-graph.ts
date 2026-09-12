import type { AtlasWorkflowStep } from './types';

export type AtlasDependencyNode = Pick<AtlasWorkflowStep, 'stepId' | 'dependencies'>;

export function validateDependencyGraph(nodes: readonly AtlasDependencyNode[]): string[] {
  const byId = new Map<string, AtlasDependencyNode>();
  for (const node of nodes) {
    if (byId.has(node.stepId)) throw new Error('dependency_duplicate');
    byId.set(node.stepId, node);
  }

  for (const node of nodes) {
    for (const dependency of node.dependencies) {
      if (!byId.has(dependency)) throw new Error('dependency_missing');
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(stepId: string) {
    if (visited.has(stepId)) return;
    if (visiting.has(stepId)) throw new Error('dependency_cycle');

    visiting.add(stepId);
    const node = byId.get(stepId);
    if (!node) throw new Error('dependency_missing');
    for (const dependency of node.dependencies) visit(dependency);
    visiting.delete(stepId);
    visited.add(stepId);
    order.push(stepId);
  }

  for (const node of nodes) visit(node.stepId);
  return order;
}
