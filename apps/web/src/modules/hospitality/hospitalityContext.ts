export const ATLAS_HOSPITALITY_PROPERTY_EVENT = 'atlas:hospitality-property-context';
const STORAGE_KEY = 'atlas.hospitality.selected-property.v1';

export type HospitalitySelectedProperty = {
  organizationId: string;
  propertyId: string;
  propertyName: string;
};

function isValid(value: unknown): value is HospitalitySelectedProperty {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.organizationId === 'string' && candidate.organizationId.trim().length > 0
    && typeof candidate.propertyId === 'string' && candidate.propertyId.trim().length > 0
    && typeof candidate.propertyName === 'string' && candidate.propertyName.trim().length > 0;
}

export function getCachedHospitalityProperty(): HospitalitySelectedProperty | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setCachedHospitalityProperty(value: HospitalitySelectedProperty) {
  if (!isValid(value)) throw new Error('invalid_hospitality_property_context');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(ATLAS_HOSPITALITY_PROPERTY_EVENT, { detail: value }));
}

export function clearCachedHospitalityProperty() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(ATLAS_HOSPITALITY_PROPERTY_EVENT, { detail: null }));
}
