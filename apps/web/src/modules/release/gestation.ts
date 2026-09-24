import type { AtlasModuleDefinition } from '../registry';

export type GestationStatus = 'complete' | 'in-progress' | 'blocked';

export type GestationPhase = {
  id: string;
  order: number;
  biologicalAnalogy: string;
  atlasLayer: string;
  status: GestationStatus;
  exitGate: string;
  evidence: readonly string[];
};

export const ATLAS_GESTATION_PHASES: readonly GestationPhase[] = [
  {
    id: 'conception',
    order: 1,
    biologicalAnalogy: 'Conception',
    atlasLayer: 'Canonical architecture',
    status: 'complete',
    exitGate: 'One canonical repository, execution protocol, module registry and production boundary exist.',
    evidence: ['Canonical GitHub repository', 'Binding execution protocol', 'A-Z module registry']
  },
  {
    id: 'genome',
    order: 2,
    biologicalAnalogy: 'Genome',
    atlasLayer: 'Identity · Tenant · RBAC · Audit',
    status: 'in-progress',
    exitGate: 'Every state-changing module enforces organization scope, permission checks and auditable writes.',
    evidence: ['Shared identity exists', 'Governed modules use tenant/RBAC controls', 'Historical and external slices still require reconciliation']
  },
  {
    id: 'organs',
    order: 3,
    biologicalAnalogy: 'Organogenesis',
    atlasLayer: 'Domain backends',
    status: 'in-progress',
    exitGate: 'Every canonical module has a real backend contract or an explicit external gate; no represented action is a placeholder.',
    evidence: ['Implemented modules exist', 'Partial modules remain visible as partial', 'Provider-backed modules remain external-gated']
  },
  {
    id: 'circulation',
    order: 4,
    biologicalAnalogy: 'Circulatory system',
    atlasLayer: 'Data · Events · Cross-module flows',
    status: 'in-progress',
    exitGate: 'Critical business events propagate once across their dependent modules with idempotency and reconciliation.',
    evidence: ['Shared data contracts exist', 'Cross-module integration hubs exist', 'A-Z transactional journeys are not yet universally proven']
  },
  {
    id: 'nervous-system',
    order: 5,
    biologicalAnalogy: 'Nervous system',
    atlasLayer: 'Flow Controller · Approvals · Assistant',
    status: 'in-progress',
    exitGate: 'Governed execution routes requests through permissions, approvals, tools and audit without bypass paths.',
    evidence: ['Universal Execution exists', 'ATLAS Work exists', 'Assistant is integrated', 'Provider readiness remains evidence-gated']
  },
  {
    id: 'skeleton',
    order: 6,
    biologicalAnalogy: 'Skeleton',
    atlasLayer: 'Navigation · Routes · State graph',
    status: 'in-progress',
    exitGate: 'Every canonical module and supported subflow is reachable, reversible and free of dead-end controls.',
    evidence: ['A-Z directory exists', 'Galaxy exists', 'Canonical navigation registry exists']
  },
  {
    id: 'brain',
    order: 7,
    biologicalAnalogy: 'Brain',
    atlasLayer: 'Intelligence · Knowledge · Automation',
    status: 'in-progress',
    exitGate: 'Intelligence can reason over authorized context and execute governed actions while preserving provider truth.',
    evidence: ['Assistant workspace exists', 'Automation control plane exists', 'External intelligence remains capability-gated']
  },
  {
    id: 'body',
    order: 8,
    biologicalAnalogy: 'Body and skin',
    atlasLayer: 'Universal product experience',
    status: 'in-progress',
    exitGate: 'Desktop, tablet and mobile experiences expose complete loading, empty, error, success and accessibility states.',
    evidence: ['Shared shell exists', 'Module experiences exist', 'Full responsive/accessibility proof remains incomplete']
  },
  {
    id: 'senses',
    order: 9,
    biologicalAnalogy: 'Senses',
    atlasLayer: 'External providers · Devices · Real world',
    status: 'in-progress',
    exitGate: 'Every advertised external capability has verified authorization, scopes, health and fail-closed degradation.',
    evidence: ['Cloudflare production boundary verified', 'Provider-backed modules are explicitly gated', 'Not every external adapter is authorized']
  },
  {
    id: 'viability',
    order: 10,
    biologicalAnalogy: 'Viability',
    atlasLayer: 'A-Z operational journeys',
    status: 'in-progress',
    exitGate: 'Critical end-to-end journeys pass from input through persistence, downstream effects, reporting and audit.',
    evidence: ['Repository-wide verification exists', 'Production route verification exists', 'All cross-module journeys are not yet proven']
  },
  {
    id: 'labor',
    order: 11,
    biologicalAnalogy: 'Labor',
    atlasLayer: 'Release candidate',
    status: 'blocked',
    exitGate: 'All prior gates are complete, migrations are applied, recovery is proven and no release-blocking P0/P1 remains.',
    evidence: ['Blocked by incomplete prior gestation gates']
  },
  {
    id: 'birth',
    order: 12,
    biologicalAnalogy: 'Birth',
    atlasLayer: 'ATLAS production complete',
    status: 'blocked',
    exitGate: 'The exact release SHA passes fail-closed production verification and the complete supported A-Z product can be operated without simulated capabilities.',
    evidence: ['Birth cannot be declared before Release Candidate']
  }
] as const;

export function summarizeGestation(modules: readonly AtlasModuleDefinition[]) {
  const moduleCounts = modules.reduce(
    (counts, module) => {
      counts[module.readiness] += 1;
      return counts;
    },
    { implemented: 0, partial: 0, 'external-gated': 0 }
  );

  const firstOpenPhase = ATLAS_GESTATION_PHASES.find((phase) => phase.status !== 'complete');

  return {
    totalModules: modules.length,
    moduleCounts,
    completedPhases: ATLAS_GESTATION_PHASES.filter((phase) => phase.status === 'complete').length,
    totalPhases: ATLAS_GESTATION_PHASES.length,
    currentPhase: firstOpenPhase ?? ATLAS_GESTATION_PHASES.at(-1)!,
    birthReady: ATLAS_GESTATION_PHASES.every((phase) => phase.status === 'complete')
  };
}
