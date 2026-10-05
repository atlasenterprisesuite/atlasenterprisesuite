import { describe, expect, it } from 'vitest';
import {
  analyzeDependencyImpact,
  buildDependencyGraph,
  validateSafeMetadata,
  type DependencyEdge,
  type DependencyNode
} from '../../packages/architecture-intelligence/src';

const nodes: DependencyNode[] = [
  {
    id: 'source:telephony-core',
    kind: 'source_file',
    label: 'Telephony core',
    risk: 'P1',
    verification: [
      { id: 'typecheck', kind: 'global', reason: 'Shared TypeScript contract changed', hardGate: true }
    ]
  },
  {
    id: 'package:communication',
    kind: 'package',
    label: 'Communication',
    risk: 'P1',
    verification: [
      { id: 'unit:communication', kind: 'focused', reason: 'Communication package is affected', hardGate: true }
    ]
  },
  {
    id: 'module:connect',
    kind: 'module',
    label: 'ATLAS Connect',
    risk: 'P1',
    verification: [
      { id: 'production-route:/connect', kind: 'focused', reason: 'Connect route is affected', hardGate: true }
    ]
  },
  {
    id: 'provider:telnyx',
    kind: 'provider',
    label: 'Telnyx',
    risk: 'P1',
    verification: [
      { id: 'provider-readiness:telnyx', kind: 'focused', reason: 'Provider boundary is affected', hardGate: true }
    ]
  },
  {
    id: 'test:telephony-e2e',
    kind: 'test_suite',
    label: 'Telephony E2E',
    risk: 'P1'
  }
];

const edges: DependencyEdge[] = [
  { from: 'source:telephony-core', to: 'package:communication', kind: 'contains', provenance: 'static_discovery' },
  { from: 'package:communication', to: 'module:connect', kind: 'depends_on', provenance: 'declared_manifest' },
  { from: 'module:connect', to: 'provider:telnyx', kind: 'requires_provider', provenance: 'declared_manifest' },
  { from: 'provider:telnyx', to: 'module:connect', kind: 'depends_on', provenance: 'declared_manifest' },
  { from: 'module:connect', to: 'test:telephony-e2e', kind: 'tested_by', provenance: 'declared_manifest' },
  { from: 'source:telephony-core', to: 'package:communication', kind: 'contains', provenance: 'static_discovery' }
];

describe('ATLAS Dependency Intelligence graph engine', () => {
  it('normalizes duplicates and traverses cycles without duplicating affected nodes', () => {
    const graph = buildDependencyGraph({ nodes, edges });
    const report = analyzeDependencyImpact({ graph, changedNodeIds: ['source:telephony-core'] });

    expect(graph.edges).toHaveLength(5);
    expect(report.direct).toEqual(['package:communication']);
    expect(report.transitive).toEqual([
      'module:connect',
      'provider:telnyx',
      'test:telephony-e2e'
    ]);
    expect(new Set([...report.direct, ...report.transitive]).size).toBe(4);
  });

  it('selects the strongest risk and focused verification with explanation paths', () => {
    const graph = buildDependencyGraph({ nodes, edges });
    const report = analyzeDependencyImpact({ graph, changedNodeIds: ['source:telephony-core'] });

    expect(report.risk).toBe('P1');
    expect(report.requiredVerification.map((item) => item.id)).toEqual([
      'provider-readiness:telnyx',
      'production-route:/connect',
      'typecheck',
      'unit:communication'
    ]);
    expect(report.explanations.some((item) =>
      item.path.join(' -> ') === 'source:telephony-core -> package:communication -> module:connect -> provider:telnyx'
    )).toBe(true);
  });

  it('holds fail-closed when an unresolved P0 dependency exists', () => {
    const graph = buildDependencyGraph({ nodes, edges });
    const report = analyzeDependencyImpact({
      graph,
      changedNodeIds: ['source:telephony-core'],
      unresolved: [
        {
          id: 'unknown:authorization-boundary',
          risk: 'P0',
          reason: 'Sensitive authorization relationship is unresolved'
        }
      ]
    });

    expect(report.risk).toBe('P0');
    expect(report.recommendation).toBe('HOLD_UNKNOWN_DEPENDENCY');
  });

  it('keeps documentation-only isolated changes at P2 while preserving global gates', () => {
    const graph = buildDependencyGraph({
      nodes: [{ id: 'source:docs', kind: 'source_file', label: 'Design doc', risk: 'P2' }],
      edges: []
    });
    const report = analyzeDependencyImpact({
      graph,
      changedNodeIds: ['source:docs'],
      globalVerification: [
        { id: 'global:verify-all', kind: 'global', reason: 'Repository gate', hardGate: true }
      ]
    });

    expect(report.risk).toBe('P2');
    expect(report.requiredVerification.map((item) => item.id)).toContain('global:verify-all');
    expect(report.recommendation).toBe('CLEAR');
  });

  it('allows secret requirement names but rejects value-like secret metadata', () => {
    expect(() => validateSafeMetadata({ secretName: 'TELNYX_API_KEY' })).not.toThrow();
    expect(() => validateSafeMetadata({ apiKey: 'sk-live-1234567890' })).toThrow(/secret_value_forbidden/);
    expect(() => validateSafeMetadata({ token: 'Bearer abc.def.ghi' })).toThrow(/secret_value_forbidden/);
  });
});
