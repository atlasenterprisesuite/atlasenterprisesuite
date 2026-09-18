import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ATLAS_HOSPITALITY_PROPERTY_EVENT,
  clearCachedHospitalityProperty,
  getCachedHospitalityProperty,
  setCachedHospitalityProperty
} from '../../apps/web/src/modules/hospitality/hospitalityContext';

beforeEach(() => localStorage.clear());

describe('Hospitality property context', () => {
  it('round-trips organization/property identity', () => {
    setCachedHospitalityProperty({ organizationId: 'org-1', propertyId: 'property-1', propertyName: 'ATLAS Orlando' });
    expect(getCachedHospitalityProperty()?.propertyId).toBe('property-1');
  });

  it('clears context explicitly', () => {
    setCachedHospitalityProperty({ organizationId: 'org-1', propertyId: 'property-1', propertyName: 'ATLAS Orlando' });
    clearCachedHospitalityProperty();
    expect(getCachedHospitalityProperty()).toBeNull();
  });

  it('rejects malformed cached data fail-closed', () => {
    localStorage.setItem('atlas.hospitality.selected-property.v1', '{bad-json');
    expect(getCachedHospitalityProperty()).toBeNull();
  });

  it('dispatches a context event after a valid selection', () => {
    const listener = vi.fn();
    window.addEventListener(ATLAS_HOSPITALITY_PROPERTY_EVENT, listener);
    setCachedHospitalityProperty({ organizationId: 'org-1', propertyId: 'property-1', propertyName: 'ATLAS Orlando' });
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(ATLAS_HOSPITALITY_PROPERTY_EVENT, listener);
  });
});
