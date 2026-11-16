export type AtlasIntentSource = 'assistant' | 'work' | 'module' | 'api' | 'system';
export type AtlasIntentRiskHint = 'low' | 'medium' | 'high' | 'critical';

export type AtlasSemanticIntentInput = {
  requestId: string;
  source: AtlasIntentSource;
  objective: string;
  moduleHint?: string | null;
  requestedCapabilities?: readonly string[];
  constraints?: readonly string[];
  riskHints?: readonly AtlasIntentRiskHint[];
  successCriteria?: readonly string[];
};

export type AtlasIntentRoute = {
  id: string;
  ownerModule: string;
  capabilities: readonly string[];
  signals: readonly string[];
  priority?: number;
};

export type AtlasSemanticIntent = {
  requestId: string;
  source: AtlasIntentSource;
  objective: string;
  routeId: string;
  ownerModule: string;
  requestedCapabilities: string[];
  constraints: string[];
  riskHints: AtlasIntentRiskHint[];
  successCriteria: string[];
  routeReason: 'module_hint' | 'capability_match' | 'semantic_signal';
};

function text(value: unknown, error: string) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(error);
  return normalized;
}

function unique(values: readonly string[] | undefined) {
  return [...new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))];
}

function routeScore(
  objective: string,
  moduleHint: string,
  requestedCapabilities: readonly string[],
  route: AtlasIntentRoute
) {
  let score = 0;
  let matched = false;
  const priority = Number.isFinite(route.priority) ? Number(route.priority) : 0;
  let reason: AtlasSemanticIntent['routeReason'] = 'semantic_signal';

  if (moduleHint && route.ownerModule.toLowerCase() === moduleHint.toLowerCase()) {
    score += 100;
    matched = true;
    reason = 'module_hint';
  }

  const capabilityMatches = requestedCapabilities.filter((capability) =>
    route.capabilities.includes(capability)
  ).length;
  if (capabilityMatches > 0) {
    score += capabilityMatches * 20;
    matched = true;
    if (reason !== 'module_hint') reason = 'capability_match';
  }

  const normalizedObjective = objective.toLowerCase();
  const signalMatches = route.signals.filter((signal) => {
    const normalized = String(signal).trim().toLowerCase();
    if (!normalized) return false;
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'u').test(normalizedObjective);
  }).length;
  score += signalMatches * 5;
  if (signalMatches > 0) matched = true;
  if (matched) score += priority;

  return { score: matched ? Math.max(score, 1) : 0, reason };
}

export function routeSemanticIntent(
  input: AtlasSemanticIntentInput,
  routes: readonly AtlasIntentRoute[]
): AtlasSemanticIntent {
  const requestId = text(input.requestId, 'semantic_intent_request_id_required');
  const objective = text(input.objective, 'semantic_intent_objective_required');
  const moduleHint = String(input.moduleHint ?? '').trim();
  const requestedCapabilities = unique(input.requestedCapabilities);

  const candidates = routes.map((route) => {
    const id = text(route.id, 'semantic_intent_route_id_required');
    const ownerModule = text(route.ownerModule, 'semantic_intent_owner_module_required');
    const capabilities = unique(route.capabilities);
    const signals = unique(route.signals);
    const scored = routeScore(objective, moduleHint, requestedCapabilities, {
      ...route,
      id,
      ownerModule,
      capabilities,
      signals
    });
    return { route: { ...route, id, ownerModule, capabilities, signals }, ...scored };
  }).filter((candidate) => candidate.score > 0);

  if (!candidates.length) throw new Error('semantic_intent_unresolved');

  // Route metadata is not authority to execute capabilities not requested by the caller.
  const supportedCandidates = candidates.filter(({ route }) =>
    requestedCapabilities.every((capability) => route.capabilities.includes(capability))
  );
  if (!supportedCandidates.length) throw new Error('semantic_intent_capability_unsupported');

  supportedCandidates.sort((a, b) =>
    b.score - a.score ||
    a.route.ownerModule.localeCompare(b.route.ownerModule) ||
    a.route.id.localeCompare(b.route.id)
  );

  const top = supportedCandidates[0];
  const tied = supportedCandidates.filter((candidate) => candidate.score === top.score);
  if (tied.length > 1) throw new Error('semantic_intent_ambiguous');

  const successCriteria = unique(input.successCriteria);
  // Route metadata helps select a module; it never grants executable capabilities.
  // A downstream policy may authorize an action, but routing alone must stay unprivileged.
  const capabilities = requestedCapabilities;

  return {
    requestId,
    source: input.source,
    objective,
    routeId: top.route.id,
    ownerModule: top.route.ownerModule,
    requestedCapabilities: capabilities,
    constraints: unique(input.constraints),
    riskHints: [...new Set(input.riskHints ?? [])],
    successCriteria: successCriteria.length
      ? successCriteria
      : ['requested outcome exists', 'result independently verified', 'evidence persisted'],
    routeReason: top.reason
  };
}
