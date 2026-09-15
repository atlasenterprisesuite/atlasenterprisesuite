import { describe, expect, it } from 'vitest';
import {
  createHospitalityAuditEnvelope,
  createPropertyContextSelectedEvent
} from '../../packages/hospitality/core-events';

describe('Hospitality core events', () => {
  it('preserves organization/property provenance', () => {
    const event = createPropertyContextSelectedEvent({
      organizationId: 'org-1',
      propertyId: 'property-1',
      actorId: 'user-1',
      occurredAt: '2026-09-15T13:30:00.000Z'
    });

    expect(event).toMatchObject({
      type: 'hospitality.property.context_selected',
      organizationId: 'org-1',
      propertyId: 'property-1',
      actorId: 'user-1'
    });
  });

  it('requires explicit result state in audit evidence', () => {
    const audit = createHospitalityAuditEnvelope({
      eventId: 'evt-1',
      organizationId: 'org-1',
      propertyId: 'property-1',
      actorId: 'user-1',
      action: 'hospitality.property.context_select',
      subjectId: 'property-1',
      timestamp: '2026-09-15T13:30:00.000Z',
      permissionDecision: 'allowed',
      result: 'success'
    });

    expect(audit.result).toBe('success');
    expect(audit.organizationId).toBe('org-1');
    expect(audit.propertyId).toBe('property-1');
  });

  it('fails closed when required provenance is blank', () => {
    expect(() => createPropertyContextSelectedEvent({
      organizationId: '',
      propertyId: 'property-1',
      actorId: 'user-1',
      occurredAt: '2026-09-15T13:30:00.000Z'
    })).toThrow(/organization/i);
  });
});
