import { describe, expect, it } from 'vitest';
import type {
  HospitalityBrand,
  HospitalityOutlet,
  HospitalityOperationalUnit,
  HospitalityProperty,
  HospitalityPropertyContext,
  HospitalitySpace
} from '../../packages/hospitality/types';

describe('Hospitality Core hierarchy', () => {
  it('requires organization and property identity across property-scoped contracts', () => {
    const brand: HospitalityBrand = {
      id: 'brand-1',
      organizationId: 'org-1',
      name: 'ATLAS Hotels',
      status: 'active'
    };
    const property: HospitalityProperty = {
      id: 'property-1',
      organizationId: 'org-1',
      brandId: brand.id,
      name: 'ATLAS Orlando',
      type: 'hotel',
      status: 'active',
      timeZone: 'America/New_York'
    };
    const outlet: HospitalityOutlet = {
      id: 'outlet-1',
      organizationId: 'org-1',
      propertyId: property.id,
      name: 'Lobby Restaurant',
      type: 'restaurant',
      status: 'active'
    };
    const space: HospitalitySpace = {
      id: 'space-1',
      organizationId: 'org-1',
      propertyId: property.id,
      outletId: outlet.id,
      name: 'Table 10',
      type: 'table',
      status: 'active'
    };
    const unit: HospitalityOperationalUnit = {
      id: 'unit-1',
      organizationId: 'org-1',
      propertyId: property.id,
      name: 'Food & Beverage',
      type: 'food_and_beverage',
      status: 'active'
    };
    const context: HospitalityPropertyContext = {
      organizationId: 'org-1',
      propertyId: property.id
    };

    expect({ brand, property, outlet, space, unit, context }).toBeTruthy();
  });
});
