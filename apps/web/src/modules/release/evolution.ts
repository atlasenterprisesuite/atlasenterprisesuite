import type { AtlasModuleDefinition } from '../registry';

export const ATLAS_ENGINEERING_STATES = [
  'specified',
  'implemented',
  'integrated',
  'tested',
  'security-verified',
  'data-verified',
  'e2e-verified',
  'production-verified'
] as const;

export type AtlasEngineeringState = (typeof ATLAS_ENGINEERING_STATES)[number];

export const ATLAS_EVIDENCE_STATES = [
  'established',
  'strongly-supported',
  'active-hypothesis',
  'open-question'
] as const;

export type AtlasEvidenceState = (typeof ATLAS_EVIDENCE_STATES)[number];

export const ATLAS_EVOLUTION_LIFECYCLE_STATES = [
  'operational-baseline',
  'active-evolution',
  'continuous-evolution',
  'superseded',
  'deprecated',
  'retired'
] as const;

export type AtlasEvolutionLifecycle = (typeof ATLAS_EVOLUTION_LIFECYCLE_STATES)[number];

export type AtlasDnaAuditLayer =
  | 'governance'
  | 'identity'
  | 'data'
  | 'runtime'
  | 'providers'
  | 'release'
  | 'product'
  | 'knowledge'
  | 'security'
  | 'lineage';

export const ATLAS_DNA_INVARIANTS = [
  {
    id: 'canonical-source-of-truth',
    name: 'Canonical source of truth',
    layer: 'governance',
    description: 'A capability has one authoritative owner and does not silently fork canonical state.'
  },
  {
    id: 'authentication-session-integrity',
    name: 'Authentication and session integrity',
    layer: 'identity',
    description: 'Protected capability verifies authenticated session state at the correct trust boundary.'
  },
  {
    id: 'tenant-isolation',
    name: 'Tenant isolation',
    layer: 'identity',
    description: 'Organization-scoped state cannot cross tenant boundaries without explicit governed authority.'
  },
  {
    id: 'rbac-least-privilege',
    name: 'RBAC and least privilege',
    layer: 'identity',
    description: 'Actions enforce the minimum permission required for the requested operation.'
  },
  {
    id: 'auditable-mutations',
    name: 'Auditable mutations',
    layer: 'data',
    description: 'Material state changes retain actor, scope, operation and evidence needed for audit.'
  },
  {
    id: 'zero-trust-external-inputs',
    name: 'Zero trust external inputs',
    layer: 'security',
    description: 'External data and provider responses are validated before becoming trusted ATLAS state.'
  },
  {
    id: 'provider-neutrality',
    name: 'Provider neutrality',
    layer: 'providers',
    description: 'Replaceable providers sit behind ATLAS-owned contracts rather than defining the domain model.'
  },
  {
    id: 'fail-closed-external-capability',
    name: 'Fail-closed external capability',
    layer: 'providers',
    description: 'Unavailable or unverified external capability degrades truthfully instead of manufacturing success.'
  },
  {
    id: 'evidence-before-completion',
    name: 'Evidence before completion',
    layer: 'release',
    description: 'Completion and production claims require the applicable test, approval and deployment evidence.'
  },
  {
    id: 'idempotency-reconciliation',
    name: 'Idempotency and reconciliation',
    layer: 'data',
    description: 'Critical mutations and cross-module events avoid duplicate effects and support reconciliation.'
  },
  {
    id: 'recoverable-operations',
    name: 'Recoverable operations',
    layer: 'runtime',
    description: 'Material operational changes are reversible or have an explicit recovery path where feasible.'
  },
  {
    id: 'complete-product-states',
    name: 'Complete product states',
    layer: 'product',
    description: 'User surfaces represent loading, empty, error, success, disabled and unavailable states explicitly.'
  },
  {
    id: 'responsive-accessibility',
    name: 'Responsive and accessible product behavior',
    layer: 'product',
    description: 'Supported experiences remain usable across viewport, input and accessibility requirements.'
  },
  {
    id: 'critical-path-observability',
    name: 'Critical-path observability',
    layer: 'runtime',
    description: 'Critical execution paths expose enough telemetry to detect and investigate failure.'
  },
  {
    id: 'no-simulated-success',
    name: 'No simulated success',
    layer: 'release',
    description: 'ATLAS does not present placeholders, fabricated metrics or simulated provider outcomes as real success.'
  },
  {
    id: 'knowledge-provenance',
    name: 'Knowledge provenance and uncertainty',
    layer: 'knowledge',
    description: 'Knowledge claims retain source provenance, confidence and uncertainty boundaries.'
  },
  {
    id: 'sensitive-data-boundary',
    name: 'Sensitive-data boundary',
    layer: 'security',
    description: 'Secrets and sensitive data remain inside their intended storage, transport and authorization boundaries.'
  },
  {
    id: 'versioned-lineage',
    name: 'Versioned lineage',
    layer: 'lineage',
    description: 'Superseded contracts and capabilities retain traceable lineage to replacements and evidence.'
  }
] as const satisfies readonly {
  id: string;
  name: string;
  layer: AtlasDnaAuditLayer;
  description: string;
}[];

export type AtlasDnaInvariantId = (typeof ATLAS_DNA_INVARIANTS)[number]['id'];
export type AtlasAuditSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export type AtlasAuditFindingState = 'open' | 'accepted-risk' | 'remediated' | 'superseded';
export type AtlasAuditTargetType = 'module' | 'module-registry';

export type AtlasAuditFinding = {
  id: string;
  targetId: string;
  targetType: AtlasAuditTargetType;
  invariantId: AtlasDnaInvariantId;
  severity: AtlasAuditSeverity;
  state: AtlasAuditFindingState;
  code: string;
  message: string;
  evidence: readonly string[];
  remediation: string;
};

export type AtlasRegistryAuditResult = {
  totalModules: number;
  findings: readonly AtlasAuditFinding[];
  blockingFindings: number;
  counts: Readonly<Record<AtlasAuditSeverity, number>>;
  coverage: {
    evaluatedInvariantIds: readonly AtlasDnaInvariantId[];
    unevaluatedInvariantIds: readonly AtlasDnaInvariantId[];
  };
};

const EVALUATED_REGISTRY_INVARIANTS: readonly AtlasDnaInvariantId[] = [
  'canonical-source-of-truth',
  'no-simulated-success'
];

const PLACEHOLDER_COPY = /\b(?:coming soon|placeholder|todo|tbd)\b/i;

function finding(input: Omit<AtlasAuditFinding, 'state'>): AtlasAuditFinding {
  return { ...input, state: 'open' };
}

export function auditAtlasModuleRegistry(
  modules: readonly AtlasModuleDefinition[]
): AtlasRegistryAuditResult {
  const findings: AtlasAuditFinding[] = [];
  const idCounts = new Map<string, number>();
  const routeCounts = new Map<string, number>();

  for (const module of modules) {
    idCounts.set(module.id, (idCounts.get(module.id) ?? 0) + 1);
    routeCounts.set(module.route, (routeCounts.get(module.route) ?? 0) + 1);
  }

  for (const [id, count] of idCounts) {
    if (count <= 1) continue;
    findings.push(finding({
      id: `registry:duplicate-id:${id}`,
      targetId: id,
      targetType: 'module-registry',
      invariantId: 'canonical-source-of-truth',
      severity: 'P1',
      code: 'duplicate-module-id',
      message: `Module id ${id} is registered ${count} times.`,
      evidence: [`registry occurrences=${count}`],
      remediation: 'Keep exactly one canonical module definition for this id and migrate consumers to it.'
    }));
  }

  for (const [route, count] of routeCounts) {
    if (count <= 1) continue;
    findings.push(finding({
      id: `registry:duplicate-route:${route}`,
      targetId: route,
      targetType: 'module-registry',
      invariantId: 'canonical-source-of-truth',
      severity: 'P1',
      code: 'duplicate-module-route',
      message: `Canonical route ${route} is owned by ${count} module definitions.`,
      evidence: [`registry occurrences=${count}`],
      remediation: 'Assign one canonical module owner for the route and remove ambiguous duplicate ownership.'
    }));
  }

  for (const module of modules) {
    const route = module.route.trim();
    if (!route.startsWith('/')) {
      findings.push(finding({
        id: `registry:invalid-route:${module.id}`,
        targetId: module.id,
        targetType: 'module',
        invariantId: 'canonical-source-of-truth',
        severity: 'P1',
        code: 'invalid-module-route',
        message: `Module ${module.id} does not expose an absolute canonical route.`,
        evidence: [`route=${JSON.stringify(module.route)}`],
        remediation: 'Declare an absolute route beginning with / and verify that navigation resolves it.'
      }));
    }

    const canonicalCopy = [module.title, module.navLabel, module.area, module.description];
    if (canonicalCopy.some((value) => value.trim().length === 0)) {
      findings.push(finding({
        id: `registry:missing-copy:${module.id}`,
        targetId: module.id,
        targetType: 'module',
        invariantId: 'canonical-source-of-truth',
        severity: 'P2',
        code: 'missing-canonical-copy',
        message: `Module ${module.id} has blank canonical registry metadata.`,
        evidence: ['title/navLabel/area/description must all be non-blank'],
        remediation: 'Restore truthful canonical metadata before this registry entry is used as product evidence.'
      }));
    }

    if (canonicalCopy.some((value) => PLACEHOLDER_COPY.test(value))) {
      findings.push(finding({
        id: `registry:placeholder-copy:${module.id}`,
        targetId: module.id,
        targetType: 'module',
        invariantId: 'no-simulated-success',
        severity: 'P2',
        code: 'placeholder-canonical-copy',
        message: `Module ${module.id} contains placeholder language in canonical registry metadata.`,
        evidence: ['placeholder token detected in title/navLabel/area/description'],
        remediation: 'Replace placeholder copy with truthful capability status or remove the unsupported surface.'
      }));
    }
  }

  findings.sort((left, right) => left.id.localeCompare(right.id));

  const counts: Record<AtlasAuditSeverity, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const item of findings) counts[item.severity] += 1;

  const evaluated = new Set<AtlasDnaInvariantId>(EVALUATED_REGISTRY_INVARIANTS);
  const unevaluatedInvariantIds = ATLAS_DNA_INVARIANTS
    .map((invariant) => invariant.id)
    .filter((id) => !evaluated.has(id));

  return {
    totalModules: modules.length,
    findings,
    blockingFindings: counts.P0 + counts.P1,
    counts,
    coverage: {
      evaluatedInvariantIds: [...EVALUATED_REGISTRY_INVARIANTS],
      unevaluatedInvariantIds
    }
  };
}

export type AtlasPostBirthPhaseId =
  | 'adaptation'
  | 'specialization'
  | 'cooperation'
  | 'memory'
  | 'intelligence'
  | 'self-correction'
  | 'continuous-evolution';

export type AtlasPostBirthPhase = {
  id: AtlasPostBirthPhaseId;
  order: number;
  atlasLayer: string;
  exitGate: string;
};

export const ATLAS_POST_BIRTH_PHASES: readonly AtlasPostBirthPhase[] = [
  {
    id: 'adaptation',
    order: 1,
    atlasLayer: 'Production feedback · operational correction',
    exitGate: 'Production evidence drives bounded corrections without weakening the verified baseline.'
  },
  {
    id: 'specialization',
    order: 2,
    atlasLayer: 'Domain capability growth',
    exitGate: 'Modules can specialize while preserving shared ATLAS DNA and canonical ownership.'
  },
  {
    id: 'cooperation',
    order: 3,
    atlasLayer: 'Cross-module organ systems',
    exitGate: 'Critical cross-module journeys are idempotent, reconciled and proven end to end.'
  },
  {
    id: 'memory',
    order: 4,
    atlasLayer: 'Knowledge · evidence · lineage',
    exitGate: 'Decisions, evidence and supersession lineage remain durable and retrievable without shadow truth.'
  },
  {
    id: 'intelligence',
    order: 5,
    atlasLayer: 'Governed reasoning · automation',
    exitGate: 'Authorized intelligence reasons and acts through governed tools while preserving provider and evidence truth.'
  },
  {
    id: 'self-correction',
    order: 6,
    atlasLayer: 'Contradiction · regression · remediation',
    exitGate: 'Detected contradictions and regressions produce tested corrections and verified evidence updates.'
  },
  {
    id: 'continuous-evolution',
    order: 7,
    atlasLayer: 'Continuous evidence-backed convergence',
    exitGate: 'Operational baselines improve continuously without erasing verified history or bypassing release gates.'
  }
] as const;

export type AtlasPostBirthStatus = 'blocked' | 'in-progress' | 'complete';
export type AtlasPostBirthPhaseState = AtlasPostBirthPhase & { status: AtlasPostBirthStatus };

export type AtlasGestationBirthSummary = {
  birthReady: boolean;
};

export function summarizeAtlasEvolution(
  modules: readonly AtlasModuleDefinition[],
  gestation: AtlasGestationBirthSummary
) {
  const registryAudit = auditAtlasModuleRegistry(modules);
  const postBirthPhases: AtlasPostBirthPhaseState[] = ATLAS_POST_BIRTH_PHASES.map((phase, index) => ({
    ...phase,
    status: !gestation.birthReady ? 'blocked' : index === 0 ? 'in-progress' : 'blocked'
  }));

  const currentPostBirthPhase = gestation.birthReady
    ? postBirthPhases.find((phase) => phase.status === 'in-progress') ?? null
    : null;

  return {
    totalModules: modules.length,
    operationalBaseline: modules.filter((module) => module.readiness === 'implemented').length,
    activeEvolution: modules.filter((module) => module.evolution === 'active').length,
    continuousEvolution: modules.filter((module) => module.evolution === 'continuous').length,
    registryAudit,
    gestationBirthReady: gestation.birthReady,
    postBirthPhases,
    currentPostBirthPhase
  };
}
