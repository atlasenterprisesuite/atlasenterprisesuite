import type { ExecutionActor, ExecutionScope } from '../execution/src/types';

/** Historical H-Series v2 product concepts, not manufactured or safety-certified products. */
export const H_SERIES_VARIANTS = Object.freeze([
  { code: 'H-B1', name: 'Base', prototypeCostUsd: 75000, purpose: 'Research and common humanoid platform' },
  { code: 'H-H1', name: 'Home', prototypeCostUsd: 90000, purpose: 'Domestic assistance research' },
  { code: 'H-O1', name: 'Office', prototypeCostUsd: 77500, purpose: 'Enterprise assistance research' },
  { code: 'H-I1', name: 'Industrial', prototypeCostUsd: 120000, purpose: 'Supervised industrial research' },
  { code: 'H-D1', name: 'Driver', prototypeCostUsd: 105000, purpose: 'Vehicle-interface research only; no actuation' }
] as const);

export type HSeriesVariant = (typeof H_SERIES_VARIANTS)[number];
export type HSeriesCatalogResult =
  | { ok: true; provenance: 'historical-planning-v2'; variants: readonly HSeriesVariant[] }
  | { ok: false; reason: 'forbidden' | 'authorization_unavailable' };

const validScope = (scope: ExecutionScope): boolean =>
  typeof scope.tenantId === 'string' && scope.tenantId.trim().length > 0 &&
  typeof scope.organizationId === 'string' && scope.organizationId.trim().length > 0;

/** Caller-supplied permissions are only an early denial gate, never authorization evidence. */
export async function readHSeriesCatalog(
  actor: ExecutionActor,
  scope: ExecutionScope,
  authorize: (actor: ExecutionActor, scope: ExecutionScope) => Promise<boolean>
): Promise<HSeriesCatalogResult> {
  if (!actor || !scope || !actor.scope || !validScope(scope) ||
      !actor.userId || actor.scope.tenantId !== scope.tenantId ||
      actor.scope.organizationId !== scope.organizationId ||
      !actor.permissions?.includes('execution.read')) {
    return { ok: false, reason: 'forbidden' };
  }
  try {
    if (!await authorize(actor, scope)) return { ok: false, reason: 'forbidden' };
    return { ok: true, provenance: 'historical-planning-v2', variants: H_SERIES_VARIANTS };
  } catch {
    return { ok: false, reason: 'authorization_unavailable' };
  }
}
