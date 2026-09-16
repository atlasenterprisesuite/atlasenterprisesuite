import { describe, expect, it } from 'vitest';
import {
  HOSPITALITY_OUTLET_TYPES,
  HOSPITALITY_PROPERTY_TYPES,
  HOSPITALITY_SPACE_TYPES
} from '../../packages/hospitality/types';
import type {
  HospitalityBrand,
  HospitalityOutlet,
  HospitalityOperationalUnit,
  HospitalityProperty,
  HospitalityPropertyContext,
  HospitalitySpace
} from '../../packages/hospitality/types';

describe('Hospitality Core hierarchy', () => {
  it('exports canonical hotel/property/outlet/space vocabularies', () => {
    expect(HOSPITALITY_PROPERTY_TYPES).toEqual(expect.arrayContaining(['hotel', 'resort', 'restaurant']));
    expect(HOSPITALITY_OUTLET_TYPES).toEqual(expect.arrayContaining(['restaurant', 'bar', 'front_desk']));
    expect(HOSPITALITY_SPACE_TYPES).toEqual(expect.arrayContaining(['guest_room', 'meeting_room', 'event_space']));
  });

  it('keeps organization and property identity explicit in property-scoped contracts', () => {
    const brand: HospitalityBrand = {
      id: 'brand-1',
      organizationId: 'org-1',
      name: 'Brand One',
      status: 'active'
    };
    const property: HospitalityProperty = {
      id: 'property-1',
      organizationId: 'org-1',
      brandId: brand.id,
      propertyKey: 'hotel-1',
      name: 'Hotel One',
      type: 'hotel',
      status: 'active',
      countryCode: 'US',
      timeZone: 'America/New_York',
      currency: 'USD'
    };
    const outlet: HospitalityOutlet = {
      id: 'outlet-1',
      organizationId: 'org-1',
      propertyId: property.id,
      name: 'Front Desk',
      type: 'front_desk',
      status: 'active'
    };
    const space: HospitalitySpace = {
      id: 'space-1',
      organizationId: 'org-1',
      propertyId: property.id,
      name: 'Room 101',
      type: 'guest_room',
      status: 'active'
    };
    const unit: HospitalityOperationalUnit = {
      id: 'unit-1',
      organizationId: 'org-1',
      propertyId: property.id,
      name: 'Housekeeping',
      type: 'housekeeping',
      status: 'active'
    };
    const context: HospitalityPropertyContext = {
      organizationId: 'org-1',
      propertyId: property.id
    };

    expect({ brand, property, outlet, space, unit, context }).toBeTruthy();
  });

  it('preserves current Room Access provider vocabulary', async () => {
    const hospitality = await import('../../packages/hospitality/types');
    expect(hospitality.PROVIDER_STATES).toContain('ready');
  });
});
