export type HospitalityScopeActor = {
  organizationId: string;
  propertyIds: readonly string[];
};

export type HospitalityScopeResource = {
  organizationId: string;
  propertyId: string;
};

export class HospitalityScopeError extends Error {
  constructor(message = 'Hospitality scope denied') {
    super(message);
    this.name = 'HospitalityScopeError';
  }
}

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function canAccessHospitalityScope(
  actor: HospitalityScopeActor,
  resource: HospitalityScopeResource
): boolean {
  if (!isNonEmpty(actor.organizationId) || !isNonEmpty(resource.organizationId) || !isNonEmpty(resource.propertyId)) {
    return false;
  }
  if (actor.organizationId !== resource.organizationId) return false;
  return actor.propertyIds.some((propertyId) => isNonEmpty(propertyId) && propertyId === resource.propertyId);
}

export function assertHospitalityScope(
  actor: HospitalityScopeActor,
  resource: HospitalityScopeResource
): void {
  if (!canAccessHospitalityScope(actor, resource)) throw new HospitalityScopeError();
}
