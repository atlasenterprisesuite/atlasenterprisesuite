import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ATLAS_MODULES, type AtlasModuleDefinition } from '../../apps/web/src/modules/registry';
import * as ecology from '../../apps/web/src/modules/release/dependency-ecology';

type EcologyApi = {
  buildRegistryDependencyEcology?: (modules: readonly AtlasModuleDefinition[]) => any;
  validateDependencyEcology?: (graph: any) => any;
};

const api = ecology as EcologyApi;

function moduleOf(overrides: Partial<AtlasModuleDefinition> = {}): AtlasModuleDefinition {
  return {
    id: 'alpha',
    title: 'Alpha',
    navLabel: 'Alpha',
    area: 'Test',
    route: '/alpha',
    readiness: 'implemented',
    requiresAuth: true,
    description: 'Alpha test module.',
    showInNavigation: true,
    ...overrides
  };
}

function node(id: string, type: 'module' | 'route') {
  return { id, type, label: id, canonicalRef: id };
}

function edge(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  relationship: 'exposes' | 'depends-on' = 'depends-on'
) {
  return {
    id,
    sourceNodeId,
    targetNodeId,
    relationship,
    evidence: { kind: 'governed-declaration', reference: 'unit-test' }
  };
}

describe('ATLAS Dependency Ecology', () => {
  it('has a dedicated release-domain dependency ecology module', () => {
    expect(
      existsSync(resolve(process.cwd(), 'apps/web/src/modules/release/dependency-ecology.ts'))
    ).toBe(true);
  });

  it('exports deterministic builder and validator contracts', () => {
    expect(typeof api.buildRegistryDependencyEcology).toBe('function');
    expect(typeof api.validateDependencyEcology).toBe('function');
  });

  it('builds canonical module and route nodes with one exposes edge per module', () => {
    expect(typeof api.buildRegistryDependencyEcology).toBe('function');
    const graph = api.buildRegistryDependencyEcology!(ATLAS_MODULES);
    const modules = graph.nodes.filter((item: any) => item.type === 'module');
    const routes = graph.nodes.filter((item: any) => item.type === 'route');
    const exposes = graph.edges.filter((item: any) => item.relationship === 'exposes');

    expect(modules).toHaveLength(ATLAS_MODULES.length);
    expect(routes).toHaveLength(new Set(ATLAS_MODULES.map((item) => item.route)).size);
    expect(exposes).toHaveLength(ATLAS_MODULES.length);

    for (const item of ATLAS_MODULES) {
      expect(exposes).toContainEqual(expect.objectContaining({
        sourceNodeId: `module:${item.id}`,
        targetNodeId: `route:${item.route}`,
        relationship: 'exposes',
        evidence: expect.objectContaining({ kind: 'canonical-registry' })
      }));
    }
  });

  it('does not invent runtime dependencies and reports runtime coverage as not evaluated', () => {
    expect(typeof api.buildRegistryDependencyEcology).toBe('function');
    const graph = api.buildRegistryDependencyEcology!(ATLAS_MODULES);

    expect(graph.edges.some((item: any) => item.relationship === 'depends-on')).toBe(false);
    expect(graph.coverage.runtimeDependencyCoverage).toBe('not-evaluated');
    expect(graph.coverage.evaluatedRelationships).toEqual(['exposes']);
  });

  it('is deterministic regardless of registry input order', () => {
    expect(typeof api.buildRegistryDependencyEcology).toBe('function');
    const forward = api.buildRegistryDependencyEcology!(ATLAS_MODULES);
    const reversed = api.buildRegistryDependencyEcology!([...ATLAS_MODULES].reverse());
    expect(reversed).toEqual(forward);
  });

  it('flags orphan dependency endpoints as P1', () => {
    expect(typeof api.validateDependencyEcology).toBe('function');
    const result = api.validateDependencyEcology!({
      nodes: [node('module:alpha', 'module')],
      edges: [edge('depends:alpha:missing', 'module:alpha', 'module:missing')],
      coverage: { evaluatedRelationships: [], runtimeDependencyCoverage: 'not-evaluated' }
    });

    expect(result.findings).toContainEqual(expect.objectContaining({
      id: 'ecology:orphan-endpoint:depends:alpha:missing',
      code: 'orphan-dependency-endpoint',
      severity: 'P1'
    }));
  });

  it('flags duplicate edge identities as P2', () => {
    expect(typeof api.validateDependencyEcology).toBe('function');
    const duplicate = edge('depends:alpha:beta', 'module:alpha', 'module:beta');
    const result = api.validateDependencyEcology!({
      nodes: [node('module:alpha', 'module'), node('module:beta', 'module')],
      edges: [duplicate, { ...duplicate }],
      coverage: { evaluatedRelationships: [], runtimeDependencyCoverage: 'not-evaluated' }
    });

    expect(result.findings).toContainEqual(expect.objectContaining({
      id: 'ecology:duplicate-edge:depends:alpha:beta',
      code: 'duplicate-dependency-edge',
      severity: 'P2'
    }));
  });

  it('flags conflicting canonical route owners as P1', () => {
    expect(typeof api.validateDependencyEcology).toBe('function');
    const result = api.validateDependencyEcology!({
      nodes: [
        node('module:alpha', 'module'),
        node('module:beta', 'module'),
        node('route:/shared', 'route')
      ],
      edges: [
        edge('exposes:alpha:/shared', 'module:alpha', 'route:/shared', 'exposes'),
        edge('exposes:beta:/shared', 'module:beta', 'route:/shared', 'exposes')
      ],
      coverage: { evaluatedRelationships: ['exposes'], runtimeDependencyCoverage: 'not-evaluated' }
    });

    expect(result.findings).toContainEqual(expect.objectContaining({
      id: 'ecology:conflicting-route-owner:route:/shared',
      code: 'conflicting-route-owner',
      severity: 'P1'
    }));
  });

  it('flags self dependencies as P1', () => {
    expect(typeof api.validateDependencyEcology).toBe('function');
    const result = api.validateDependencyEcology!({
      nodes: [node('module:alpha', 'module')],
      edges: [edge('depends:alpha:alpha', 'module:alpha', 'module:alpha')],
      coverage: { evaluatedRelationships: ['depends-on'], runtimeDependencyCoverage: 'partial' }
    });

    expect(result.findings).toContainEqual(expect.objectContaining({
      id: 'ecology:self-dependency:depends:alpha:alpha',
      code: 'self-module-dependency',
      severity: 'P1'
    }));
  });

  it('flags dependency cycles deterministically as P1', () => {
    expect(typeof api.validateDependencyEcology).toBe('function');
    const graph = {
      nodes: [node('module:alpha', 'module'), node('module:beta', 'module')],
      edges: [
        edge('depends:alpha:beta', 'module:alpha', 'module:beta'),
        edge('depends:beta:alpha', 'module:beta', 'module:alpha')
      ],
      coverage: { evaluatedRelationships: ['depends-on'], runtimeDependencyCoverage: 'partial' }
    };
    const result = api.validateDependencyEcology!(graph);

    expect(result.findings).toContainEqual(expect.objectContaining({
      id: 'ecology:dependency-cycle:module:alpha|module:beta',
      code: 'dependency-cycle',
      severity: 'P1'
    }));
  });

  it('validates the canonical registry graph without fabricating cross-module coverage', () => {
    expect(typeof api.buildRegistryDependencyEcology).toBe('function');
    expect(typeof api.validateDependencyEcology).toBe('function');
    const graph = api.buildRegistryDependencyEcology!(ATLAS_MODULES);
    const result = api.validateDependencyEcology!(graph);

    expect(result.findings).toEqual([]);
    expect(result.blockingFindings).toBe(0);
    expect(graph.coverage.runtimeDependencyCoverage).toBe('not-evaluated');
  });

  it('keeps registry ownership independent from runtime dependency claims', () => {
    expect(typeof api.buildRegistryDependencyEcology).toBe('function');
    const graph = api.buildRegistryDependencyEcology!([
      moduleOf(),
      moduleOf({ id: 'beta', title: 'Beta', navLabel: 'Beta', route: '/beta' })
    ]);

    expect(graph.edges.map((item: any) => item.relationship)).toEqual(['exposes', 'exposes']);
  });
});
