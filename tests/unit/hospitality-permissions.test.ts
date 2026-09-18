import { describe, expect, it } from 'vitest';
import { hasHospitalityPermission } from '../../packages/hospitality/permissions';
import type { HospitalityActorContext } from '../../packages/hospitality/types';

describe('Hospitality permissions', () => {
  const actor = (permissions: HospitalityActorContext['permissions']): HospitalityActorContext => ({
    organizationId: 'org-1',
    userId: 'user-1',
    permissions
  });

  it('keeps room-access admin compatibility for room-access capabilities', () => {
    expect(hasHospitalityPermission(actor(['hospitality.access.admin']), 'hospitality.access.configure')).toBe(true);
    expect(hasHospitalityPermission(actor(['hospitality.access.admin']), 'hospitality.access.audit')).toBe(true);
  });

  it('supports property permissions', () => {
    expect(hasHospitalityPermission(actor(['hospitality.property.read']), 'hospitality.property.read')).toBe(true);
    expect(hasHospitalityPermission(actor([]), 'hospitality.property.manage')).toBe(false);
  });

  it('does not let room-access admin become a global Hospitality root permission', () => {
    expect(hasHospitalityPermission(actor(['hospitality.access.admin']), 'hospitality.property.manage')).toBe(false);
    expect(hasHospitalityPermission(actor(['hospitality.access.admin']), 'hospitality.restaurant.refund')).toBe(false);
  });
});
