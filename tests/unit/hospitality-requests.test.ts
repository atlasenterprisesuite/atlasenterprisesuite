import { describe, expect, it } from 'vitest';
import {
  selectDispatchCandidate,
  transitionHospitalityRequest,
  type HospitalityDispatchCandidate
} from '../../packages/hospitality/requests';

describe('Hospitality service requests', () => {
  it('allows the canonical happy-path state progression', () => {
    expect(transitionHospitalityRequest('new', 'queued')).toBe('queued');
    expect(transitionHospitalityRequest('queued', 'assigned')).toBe('assigned');
    expect(transitionHospitalityRequest('assigned', 'accepted')).toBe('accepted');
    expect(transitionHospitalityRequest('accepted', 'in_progress')).toBe('in_progress');
    expect(transitionHospitalityRequest('in_progress', 'completed')).toBe('completed');
    expect(transitionHospitalityRequest('completed', 'verified')).toBe('verified');
  });

  it('rejects an impossible jump', () => {
    expect(() => transitionHospitalityRequest('new', 'verified')).toThrow('invalid_request_transition');
  });

  it('dispatches only inside the requested property/department and chooses least-loaded when configured', () => {
    const candidates: HospitalityDispatchCandidate[] = [
      { userId: 'u1', propertyId: 'p1', departmentId: 'housekeeping', active: true, available: true, openAssignments: 4 },
      { userId: 'u2', propertyId: 'p1', departmentId: 'housekeeping', active: true, available: true, openAssignments: 1 },
      { userId: 'u3', propertyId: 'p2', departmentId: 'housekeeping', active: true, available: true, openAssignments: 0 }
    ];
    expect(selectDispatchCandidate({ strategy: 'least_loaded', propertyId: 'p1', departmentId: 'housekeeping', candidates }))
      .toEqual({ status: 'assigned', userId: 'u2' });
  });

  it('returns unassigned instead of crossing property scope when no eligible candidate exists', () => {
    expect(selectDispatchCandidate({
      strategy: 'least_loaded',
      propertyId: 'p1',
      departmentId: 'engineering',
      candidates: [{ userId: 'u3', propertyId: 'p2', departmentId: 'engineering', active: true, available: true, openAssignments: 0 }]
    })).toEqual({ status: 'unassigned', reason: 'no_eligible_candidate' });
  });
});
