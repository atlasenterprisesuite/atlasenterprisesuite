import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ATLAS_MODULES, type AtlasModuleDefinition } from '../../apps/web/src/modules/registry';
import { summarizeGestation } from '../../apps/web/src/modules/release/gestation';
import * as evolution from '../../apps/web/src/modules/release/evolution';

type Finding = {
  id: string;
  targetId: string;
  invariantId: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  code: string;
};

type RegistryAuditResult = {
  findings: Finding[];
  blockingFindings: number;
  coverage: {
    evaluatedInvariantIds: string[];
    unevaluatedInvariantIds: string[];
  };
};

type EvolutionSummary = {
  gestationBirthReady: boolean;
  postBirthPhases: Array<{ id: string; status: 'blocked' | 'in-progress' | 'complete' }>;
  currentPostBirthPhase: { id: string } | null;
};

const namespace = evolution as Record<string, unknown>;

const moduleOf = (overrides: Partial<AtlasModuleDefinition> = {}): AtlasModuleDefinition => ({
  id: 'alpha',
  title: 'ATLAS Alpha',
  navLabel: 'Alpha',
  area: 'Platform',
  route: '/alpha',
  readiness: 'implemented',
  evolution: 'none',
  requiresAuth: true,
  description: 'Canonical Alpha capability.',
  showInNavigation: true,
  ...overrides
});

const getAudit = () => {
  const value = namespace.auditAtlasModuleRegistry;
  expect(typeof value).toBe('function');
  return typeof value === 'function'
    ? (value as (modules: readonly AtlasModuleDefinition[]) => RegistryAuditResult)
    : null;
};

describe('ATLAS Evolution Kernel', () => {
  it('has a dedicated release-domain evolution module', () => {
    expect(existsSync('apps/web/src/modules/release/evolution.ts')).toBe(true);
  });

  it('defines the 18 immutable ATLAS DNA invariants', () => {
    const invariants = namespace.ATLAS_DNA_INVARIANTS;
    expect(Array.isArray(invariants)).toBe(true);
    if (!Array.isArray(invariants)) return;

    expect(invariants).toHaveLength(18);
    const ids = invariants.map((item) => (item as { id: string }).id);
    expect(new Set(ids).size).toBe(18);
    expect(ids).toEqual(expect.arrayContaining([
      'canonical-source-of-truth',
      'tenant-isolation',
      'rbac-least-privilege',
      'fail-closed-external-capability',
      'evidence-before-completion',
      'no-simulated-success',
      'knowledge-provenance',
      'versioned-lineage'
    ]));
  });

  it('keeps engineering, evidence and evolution states independent', () => {
    expect(namespace.ATLAS_ENGINEERING_STATES).toEqual([
      'specified',
      'implemented',
      'integrated',
      'tested',
      'security-verified',
      'data-verified',
      'e2e-verified',
      'production-verified'
    ]);
    expect(namespace.ATLAS_EVIDENCE_STATES).toEqual([
      'established',
      'strongly-supported',
      'active-hypothesis',
      'open-question'
    ]);
    expect(namespace.ATLAS_EVOLUTION_LIFECYCLE_STATES).toEqual([
      'operational-baseline',
      'active-evolution',
      'continuous-evolution',
      'superseded',
      'deprecated',
      'retired'
    ]);
  });

  it('allows an implemented module to remain in active evolution', () => {
    const audit = getAudit();
    if (!audit) return;
    const result = audit([moduleOf({ evolution: 'active' })]);
    expect(result.findings).toHaveLength(0);
  });

  it('flags duplicate module IDs as P1 canonical-source drift', () => {
    const audit = getAudit();
    if (!audit) return;
    const result = audit([
      moduleOf(),
      moduleOf({ route: '/alpha-copy', description: 'Second canonical-looking record.' })
    ]);
    expect(result.findings).toContainEqual(expect.objectContaining({
      id: 'registry:duplicate-id:alpha',
      targetId: 'alpha',
      invariantId: 'canonical-source-of-truth',
      severity: 'P1',
      code: 'duplicate-module-id'
    }));
  });

  it('flags duplicate routes as P1 canonical-source drift', () => {
    const audit = getAudit();
    if (!audit) return;
    const result = audit([
      moduleOf(),
      moduleOf({ id: 'beta', title: 'ATLAS Beta', navLabel: 'Beta' })
    ]);
    expect(result.findings).toContainEqual(expect.objectContaining({
      id: 'registry:duplicate-route:/alpha',
      targetId: '/alpha',
      invariantId: 'canonical-source-of-truth',
      severity: 'P1',
      code: 'duplicate-module-route'
    }));
  });

  it('flags non-absolute routes as P1 navigation integrity defects', () => {
    const audit = getAudit();
    if (!audit) return;
    const result = audit([moduleOf({ route: 'alpha' })]);
    expect(result.findings).toContainEqual(expect.objectContaining({
      id: 'registry:invalid-route:alpha',
      targetId: 'alpha',
      invariantId: 'canonical-source-of-truth',
      severity: 'P1',
      code: 'invalid-module-route'
    }));
  });

  it('flags blank canonical copy as P2 evidence debt', () => {
    const audit = getAudit();
    if (!audit) return;
    const result = audit([moduleOf({ description: '   ' })]);
    expect(result.findings).toContainEqual(expect.objectContaining({
      id: 'registry:missing-copy:alpha',
      targetId: 'alpha',
      invariantId: 'canonical-source-of-truth',
      severity: 'P2',
      code: 'missing-canonical-copy'
    }));
  });

  it('flags placeholder copy instead of treating it as implementation evidence', () => {
    const audit = getAudit();
    if (!audit) return;
    const result = audit([moduleOf({ description: 'Coming Soon' })]);
    expect(result.findings).toContainEqual(expect.objectContaining({
      id: 'registry:placeholder-copy:alpha',
      targetId: 'alpha',
      invariantId: 'no-simulated-success',
      severity: 'P2',
      code: 'placeholder-canonical-copy'
    }));
  });

  it('audits the canonical registry without fabricating full DNA coverage', () => {
    const audit = getAudit();
    if (!audit) return;
    const result = audit(ATLAS_MODULES);
    const structuralCodes = new Set([
      'duplicate-module-id',
      'duplicate-module-route',
      'invalid-module-route'
    ]);
    expect(result.findings.filter((finding) => structuralCodes.has(finding.code))).toHaveLength(0);
    expect(result.blockingFindings).toBe(0);
    expect(result.coverage.evaluatedInvariantIds).toEqual([
      'canonical-source-of-truth',
      'no-simulated-success'
    ]);
    expect(result.coverage.unevaluatedInvariantIds).toHaveLength(16);
  });

  it('defines seven post-Birth phases and keeps them blocked before Gestation birth', () => {
    const phases = namespace.ATLAS_POST_BIRTH_PHASES;
    expect(Array.isArray(phases)).toBe(true);
    if (!Array.isArray(phases)) return;
    expect(phases.map((phase) => (phase as { id: string }).id)).toEqual([
      'adaptation',
      'specialization',
      'cooperation',
      'memory',
      'intelligence',
      'self-correction',
      'continuous-evolution'
    ]);

    const summarize = namespace.summarizeAtlasEvolution;
    expect(typeof summarize).toBe('function');
    if (typeof summarize !== 'function') return;

    const summary = (summarize as (
      modules: readonly AtlasModuleDefinition[],
      gestation: ReturnType<typeof summarizeGestation>
    ) => EvolutionSummary)(ATLAS_MODULES, summarizeGestation(ATLAS_MODULES));

    expect(summary.gestationBirthReady).toBe(false);
    expect(summary.postBirthPhases.every((phase) => phase.status === 'blocked')).toBe(true);
    expect(summary.currentPostBirthPhase).toBeNull();
  });
});
