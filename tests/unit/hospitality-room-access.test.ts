import { describe, expect, it } from 'vitest';
import {
  buildRoomAccessAuditEvent,
  evaluateRoomAccessRequest,
  type HospitalityActorContext,
  type RoomAccessRequest
} from '../../packages/hospitality/access';

const actor: HospitalityActorContext = {
  organizationId: 'org-1',
  userId: 'user-1',
  permissions: ['hospitality.access.issue']
};

const request: RoomAccessRequest = {
  propertyId: 'property-1',
  roomId: 'room-101',
  assignmentReference: 'reservation-1',
  startsAt: '2026-09-11T20:00:00.000Z',
  expiresAt: '2026-09-12T15:00:00.000Z',
  reason: 'guest_checkin'
};

describe('ATLAS Hospitality room access domain', () => {
  it('blocks issuance until an authorized provider is ready', () => {
    const decision = evaluateRoomAccessRequest(actor, 'not_configured', request);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('authorized_provider_not_ready');
  });

  it('requires explicit room-access issuance permission', () => {
    const decision = evaluateRoomAccessRequest({ ...actor, permissions: ['hospitality.access.read'] }, 'ready', request);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('permission_required');
  });

  it('rejects an expiry that is not after the start time', () => {
    const decision = evaluateRoomAccessRequest(actor, 'ready', {
      ...request,
      expiresAt: request.startsAt
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('expiry_must_follow_start');
  });

  it('allows a complete request only when authorization and provider readiness are satisfied', () => {
    expect(evaluateRoomAccessRequest(actor, 'ready', request)).toEqual({ allowed: true, reasons: [] });
  });

  it('creates audit metadata without raw key material', () => {
    const event = buildRoomAccessAuditEvent(actor, request);
    expect(event.organizationId).toBe(actor.organizationId);
    expect(event.roomId).toBe(request.roomId);
    expect(event).not.toHaveProperty('key');
    expect(event).not.toHaveProperty('payload');
    expect(event).not.toHaveProperty('secret');
  });
});
