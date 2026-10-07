import type { AtlasModuleDefinition } from '../registry';

export type AtlasPortfolioDisposition = 'keep' | 'merge' | 'compatibility' | 'retire';
export type AtlasPortfolioSurface = 'primary' | 'hub' | 'embedded' | 'internal';
export type AtlasPortfolioFamily =
  | 'Platform'
  | 'Intelligence'
  | 'Enterprise'
  | 'Finance'
  | 'People'
  | 'Health & Care'
  | 'Creative'
  | 'Communications'
  | 'Mobility & Spatial'
  | 'Hospitality'
  | 'Entertainment'
  | 'Protection';

export type AtlasPortfolioDecision = {
  moduleId: string;
  family: AtlasPortfolioFamily;
  disposition: AtlasPortfolioDisposition;
  surface: AtlasPortfolioSurface;
  ownerModuleId?: string;
  rationale: string;
  evolution: string;
};

export type AtlasCapabilityConvergenceState = 'merged' | 'private' | 'compatibility' | 'hold';

export type AtlasCapabilityConvergence = {
  id: string;
  label: string;
  state: AtlasCapabilityConvergenceState;
  ownerModuleId?: string;
  route?: string;
  rationale: string;
};

type PortfolioOverride = Omit<AtlasPortfolioDecision, 'moduleId' | 'family'> & {
  family?: AtlasPortfolioFamily;
};

const FAMILY_BY_AREA: Record<string, AtlasPortfolioFamily> = {
  Platform: 'Platform',
  Intelligence: 'Intelligence',
  Business: 'Enterprise',
  Operations: 'Enterprise',
  Finance: 'Finance',
  People: 'People',
  Health: 'Health & Care',
  Creative: 'Creative',
  Communications: 'Communications',
  Mobility: 'Mobility & Spatial',
  Spatial: 'Mobility & Spatial',
  Hospitality: 'Hospitality',
  Entertainment: 'Entertainment',
  Protection: 'Protection'
};

const PORTFOLIO_OVERRIDES: Readonly<Record<string, PortfolioOverride>> = {
  automations: {
    disposition: 'merge',
    surface: 'embedded',
    ownerModuleId: 'work',
    rationale: 'Automation is an execution capability of ATLAS Work, not a parallel operating system.',
    evolution: 'Unify templates, schedules and governed actions under Work while preserving the compatibility route.'
  },
  'bible-os': {
    disposition: 'merge',
    surface: 'embedded',
    ownerModuleId: 'knowledge',
    rationale: 'Bible OS is a specialized Knowledge Atlas research domain.',
    evolution: 'Keep textual provenance and research depth while inheriting Knowledge lineage, search and evidence controls.'
  },
  revenue: {
    disposition: 'merge',
    surface: 'embedded',
    ownerModuleId: 'business',
    rationale: 'Revenue Operations crosses CRM, Commerce and Finance and belongs to the Business command layer.',
    evolution: 'Keep the compatibility route while exposing revenue workflows from Business and Finance journeys.'
  },
  accounting: {
    disposition: 'merge',
    surface: 'embedded',
    ownerModuleId: 'finance',
    rationale: 'Accounting is the financial system of record inside ATLAS Finance rather than a competing top-level product.',
    evolution: 'Deepen GL, AP, AR, close, reconciliation and reporting while keeping Finance as the family entry point.'
  },
  analytics: {
    disposition: 'merge',
    surface: 'embedded',
    ownerModuleId: 'business',
    rationale: 'Business Analytics is a shared insight capability consumed by Business and domain modules.',
    evolution: 'Keep source-backed analytics and eliminate duplicate dashboards that restate the same measures.'
  },
  telecom: {
    disposition: 'merge',
    surface: 'embedded',
    ownerModuleId: 'connect',
    rationale: 'Telecom and carrier operations are provider-backed capabilities of ATLAS Connect.',
    evolution: 'Keep carrier, MVNO, messaging and calling adapters behind Connect capability gates.'
  },
  people: {
    disposition: 'keep',
    surface: 'hub',
    rationale: 'People is the workforce family hub spanning Payroll, Learning and future HR operations.',
    evolution: 'Evolve into the unified people record and workforce journey layer without duplicating Payroll or Learning.'
  },
  insurance: {
    disposition: 'keep',
    surface: 'hub',
    rationale: 'Insurance has a distinct regulated verification boundary and can serve Health, Care and enterprise protection.',
    evolution: 'Expand only through verified payer, policy and eligibility adapters.'
  },
  'site-review': {
    disposition: 'merge',
    surface: 'embedded',
    ownerModuleId: 'studio',
    rationale: 'Site Review is a review/execution capability of Studio and Web Launch, not a standalone creative product.',
    evolution: 'Keep review evidence while consolidating launch, content intelligence and creator workflows.'
  },
  'release-control': {
    disposition: 'merge',
    surface: 'internal',
    ownerModuleId: 'cloud',
    rationale: 'Release Control is an internal Cloud operations capability and should not compete with Cloud Command Center.',
    evolution: 'Consolidate release, production verification, readiness and runtime integrity under Release & Operations.'
  },
  execution: {
    disposition: 'merge',
    surface: 'internal',
    ownerModuleId: 'work',
    rationale: 'Universal Execution is the engine beneath Work and governed automation, not a separate everyday product.',
    evolution: 'Keep execution routes and evidence while surfacing them through Work and Cloud operations.'
  }
};

function defaultFamily(area: string): AtlasPortfolioFamily {
  return FAMILY_BY_AREA[area] ?? 'Enterprise';
}

function defaultSurface(module: AtlasModuleDefinition): AtlasPortfolioSurface {
  if (!module.showInNavigation) return 'embedded';
  return 'primary';
}

export function getAtlasPortfolioDecision(
  moduleId: string,
  modules?: readonly AtlasModuleDefinition[]
): AtlasPortfolioDecision | null {
  const registry = modules ?? [];
  const module = registry.find((item) => item.id === moduleId);
  if (module) return decisionFor(module);

  const override = PORTFOLIO_OVERRIDES[moduleId];
  if (!override) return null;

  return {
    moduleId,
    family: override.family ?? 'Enterprise',
    ...override
  };
}

function decisionFor(module: AtlasModuleDefinition): AtlasPortfolioDecision {
  const override = PORTFOLIO_OVERRIDES[module.id];
  if (override) {
    return {
      moduleId: module.id,
      family: override.family ?? defaultFamily(module.area),
      ...override
    };
  }

  return {
    moduleId: module.id,
    family: defaultFamily(module.area),
    disposition: 'keep',
    surface: defaultSurface(module),
    rationale: 'Canonical module retains a distinct product or domain boundary in the current ATLAS registry.',
    evolution: 'Preserve the verified baseline and evolve through shared ATLAS DNA, evidence and provider boundaries.'
  };
}

export function buildAtlasPortfolio(
  modules: readonly AtlasModuleDefinition[]
): readonly AtlasPortfolioDecision[] {
  return modules
    .map(decisionFor)
    .sort((left, right) => left.moduleId.localeCompare(right.moduleId));
}

export function getAtlasPortfolioDecisionFromRegistry(
  moduleId: string,
  modules: readonly AtlasModuleDefinition[]
) {
  return modules.find((module) => module.id === moduleId)
    ? decisionFor(modules.find((module) => module.id === moduleId)!)
    : null;
}

export const ATLAS_CAPABILITY_CONVERGENCE: readonly AtlasCapabilityConvergence[] = [
  {
    id: 'atlas-max',
    label: 'ATLAS MAX',
    state: 'merged',
    ownerModuleId: 'assistant',
    route: '/max',
    rationale: 'Premium governed intelligence is an Assistant capacity/entitlement layer rather than another AI product.'
  },
  {
    id: 'oracle',
    label: 'ATLAS Mystic Oracle',
    state: 'private',
    ownerModuleId: 'assistant',
    route: '/assistant/oracle',
    rationale: 'Private reflective readings remain an explicitly private Assistant capability, not enterprise truth.'
  },
  {
    id: 'faith-reflection',
    label: 'ATLAS Faith & Reflection',
    state: 'private',
    ownerModuleId: 'knowledge',
    route: '/wellbeing/faith',
    rationale: 'Faith reflection remains a personal reflection capability with explicit boundaries, separate from operational evidence.'
  },
  {
    id: 'image-lab',
    label: 'ATLAS Image Lab',
    state: 'merged',
    ownerModuleId: 'studio',
    route: '/studio/create?type=image',
    rationale: 'Image generation/editing belongs to the canonical Creator/Studio workspace and Library lineage.'
  },
  {
    id: 'clean-scan-3d',
    label: 'CleanScan 3D',
    state: 'merged',
    ownerModuleId: 'city',
    route: '/city/twin',
    rationale: '3D capture and reconstruction are spatial/Urban Twin capabilities instead of a duplicate standalone product.'
  },
  {
    id: 'device-dna',
    label: 'Device DNA · Genesis · Phoenix',
    state: 'merged',
    ownerModuleId: 'device-os',
    route: '/device-os',
    rationale: 'Device identity, recovery and adaptive computing are native Device OS capabilities.'
  },
  {
    id: 'mvno-carrier',
    label: 'ATLAS Carrier / MVNO',
    state: 'merged',
    ownerModuleId: 'connect',
    route: '/connect',
    rationale: 'Carrier onboarding, eSIM and network orchestration belong to Connect with external actions fail-closed.'
  },
  {
    id: 'financial-network',
    label: 'ATLAS Financial Network',
    state: 'merged',
    ownerModuleId: 'pay',
    route: '/finance/pay',
    rationale: 'Ledger, issuing, payouts and replaceable rail adapters converge under ATLAS Pay.'
  },
  {
    id: 'ride-apps',
    label: 'Ride client · driver · dealer · rental',
    state: 'merged',
    ownerModuleId: 'ride',
    route: '/ride',
    rationale: 'Role-specific Ride experiences remain one product with role-aware navigation instead of separate app identities.'
  },
  {
    id: 'spatial-interface',
    label: 'ATLAS Spatial Interface',
    state: 'merged',
    ownerModuleId: 'device-os',
    rationale: 'Gesture, device and spatial input capabilities belong to Device OS and may surface through Galaxy where navigation is spatial.'
  },
  {
    id: 'work-command-center',
    label: 'ATLAS Work Command Center',
    state: 'merged',
    ownerModuleId: 'work',
    route: '/work',
    rationale: 'Work Command Center is the canonical execution surface inside ATLAS Work, not a separate product.'
  },
  {
    id: 'business-launch-360',
    label: 'Business Launch 360',
    state: 'merged',
    ownerModuleId: 'advisory',
    route: '/advisory/business-launch-360',
    rationale: 'Business formation, launch planning and commercial readiness converge under ATLAS Advisory Office.'
  },
  {
    id: 'ai-universe',
    label: 'ATLAS AI Universe',
    state: 'merged',
    ownerModuleId: 'studio',
    route: '/studio/ai-universe',
    rationale: 'Creative provider discovery and orchestration remain a Studio capability while conversational intelligence stays in Assistant.'
  },
  {
    id: 'creator-library',
    label: 'ATLAS Creator Library',
    state: 'merged',
    ownerModuleId: 'studio',
    route: '/studio/library',
    rationale: 'Generated creative assets, versions and provenance stay inside the canonical Studio library.'
  },
  {
    id: 'remote-assist',
    label: 'ATLAS Remote Assist',
    state: 'merged',
    ownerModuleId: 'device-os',
    route: '/device-os',
    rationale: 'Remote assistance is a Device OS capability and remains fail-closed until an authorized native adapter is available.'
  },
  {
    id: 'device-recovery-security',
    label: 'ATLAS Device Recovery & Security',
    state: 'merged',
    ownerModuleId: 'device-os',
    route: '/device-os',
    rationale: 'Boot, storage, memory, driver, malware and recovery workflows converge into Device OS instead of a separate PC-care product.'
  },
  {
    id: 'jaque-mate-sentinel',
    label: 'Jaque Mate + Sentinel',
    state: 'merged',
    ownerModuleId: 'health',
    route: '/health/research/frontiers/disease-reconstruction/jaque-mate-sentinel',
    rationale: 'Health research falsification and cure-candidate surveillance remain inside ATLAS Health with evidence boundaries.'
  },
  {
    id: 'atlas-partner-network',
    label: 'ATLAS Partner Network',
    state: 'merged',
    ownerModuleId: 'business',
    route: '/business/network',
    rationale: 'Partner pricing, commissions, payouts and compliance are Business growth operations, distinct from carrier connectivity.'
  },
  {
    id: 'atlas-drive',
    label: 'ATLAS Drive',
    state: 'hold',
    ownerModuleId: 'work',
    rationale: 'Historical storage concept recovered. Work remains the intended family, but no canonical ATLAS Drive route is registered yet.'
  },
  {
    id: 'atlas-cars',
    label: 'ATLAS Cars',
    state: 'hold',
    ownerModuleId: 'ride',
    rationale: 'Vehicle-platform concept is retained for Ride and Device OS convergence, but no canonical production product surface is verified yet.'
  },
  {
    id: 'parks-global',
    label: 'ATLAS Parks Global',
    state: 'hold',
    rationale: 'Historical concept recovered, but no canonical production module was located. Keep as a concept until ownership and implementation evidence exist.'
  },
  {
    id: 'autowash',
    label: 'ATLAS AutoWash',
    state: 'hold',
    rationale: 'Historical concept recovered, but no canonical production module was located. Do not promote it into navigation without implementation evidence.'
  },
  {
    id: 'latin-command-center',
    label: 'ATLAS Latin Command Center',
    state: 'hold',
    rationale: 'Regional-command concept is retained as product research until a canonical route, owner and data boundary are implemented.'
  }
] as const;

export type AtlasPortfolioFinding = {
  id: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  code: string;
  message: string;
};

export function validateAtlasPortfolio(
  portfolio: readonly AtlasPortfolioDecision[],
  modules: readonly AtlasModuleDefinition[]
) {
  const findings: AtlasPortfolioFinding[] = [];
  const moduleIds = new Set(modules.map((module) => module.id));
  const decisions = new Map<string, AtlasPortfolioDecision[]>();

  for (const decision of portfolio) {
    decisions.set(decision.moduleId, [...(decisions.get(decision.moduleId) ?? []), decision]);
    if (!moduleIds.has(decision.moduleId)) {
      findings.push({
        id: `portfolio:unknown-module:${decision.moduleId}`,
        severity: 'P1',
        code: 'unknown-portfolio-module',
        message: `Portfolio decision references unknown module ${decision.moduleId}.`
      });
    }

    if ((decision.disposition === 'merge' || decision.disposition === 'retire') && !decision.ownerModuleId) {
      findings.push({
        id: `portfolio:missing-owner:${decision.moduleId}`,
        severity: 'P1',
        code: 'missing-replacement-owner',
        message: `Portfolio decision ${decision.moduleId} requires a canonical owner.`
      });
    }

    if (decision.ownerModuleId && !moduleIds.has(decision.ownerModuleId)) {
      findings.push({
        id: `portfolio:unknown-owner:${decision.moduleId}:${decision.ownerModuleId}`,
        severity: 'P1',
        code: 'unknown-owner-module',
        message: `Portfolio owner ${decision.ownerModuleId} for ${decision.moduleId} is not canonical.`
      });
    }

    const module = modules.find((candidate) => candidate.id === decision.moduleId);
    if (module) {
      const shouldBePrimaryNavigation = decision.disposition === 'keep';
      if (module.showInNavigation !== shouldBePrimaryNavigation) {
        findings.push({
          id: `portfolio:navigation-mismatch:${decision.moduleId}`,
          severity: 'P1',
          code: 'navigation-disposition-mismatch',
          message: shouldBePrimaryNavigation
            ? `Canonical owner ${decision.moduleId} must remain discoverable in primary module navigation.`
            : `Converged module ${decision.moduleId} must not remain a duplicate primary navigation item.`
        });
      }
    }
  }

  for (const module of modules) {
    const count = decisions.get(module.id)?.length ?? 0;
    if (count !== 1) {
      findings.push({
        id: `portfolio:decision-count:${module.id}`,
        severity: 'P1',
        code: 'invalid-decision-count',
        message: `Canonical module ${module.id} has ${count} portfolio decisions; exactly one is required.`
      });
    }
  }

  const ownerByModule = new Map(
    portfolio
      .filter((decision) => Boolean(decision.ownerModuleId))
      .map((decision) => [decision.moduleId, decision.ownerModuleId!] as const)
  );

  for (const start of ownerByModule.keys()) {
    const visited = new Set<string>();
    let current: string | undefined = start;
    while (current && ownerByModule.has(current)) {
      if (visited.has(current)) {
        findings.push({
          id: `portfolio:owner-cycle:${[...visited].sort().join('|')}`,
          severity: 'P1',
          code: 'portfolio-owner-cycle',
          message: 'Portfolio ownership contains a cycle and cannot converge to one canonical owner.'
        });
        break;
      }
      visited.add(current);
      current = ownerByModule.get(current);
    }
  }

  const deduplicated = [...new Map(findings.map((finding) => [finding.id, finding])).values()]
    .sort((left, right) => left.id.localeCompare(right.id));
  const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const finding of deduplicated) counts[finding.severity] += 1;

  return {
    findings: deduplicated,
    blockingFindings: counts.P0 + counts.P1,
    counts
  };
}
