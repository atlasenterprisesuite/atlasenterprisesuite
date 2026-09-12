import { describe, expect, it } from 'vitest';
import { createDormakabaAdapter } from '../../supabase/functions/atlas-hospitality-access/providers/dormakaba';
import { createSaltoAdapter } from '../../supabase/functions/atlas-hospitality-access/providers/salto';
import { createVingcardAdapter } from '../../supabase/functions/atlas-hospitality-access/providers/vingcard';

const context = {
  organizationId: 'org-1',
  propertyId: 'hotel-1',
  userId: 'user-1',
  providerInstanceId: 'provider-1',
  providerPropertyId: 'site-1'
};

const issueRequest = {
  propertyId: 'hotel-1',
  roomId: '101',
  providerRoomId: '101',
  assignmentReference: 'reservation-1',
  startsAt: '2026-09-11T20:00:00.000Z',
  expiresAt: '2026-09-12T15:00:00.000Z',
  reason: 'guest_checkin' as const,
  credentialType: 'mobile_key' as const
};

describe('ATLAS Hospitality SALTO adapters', () => {
  it('verifies SALTO Space connectivity without claiming issuance is complete', async () => {
    const calls: string[] = [];
    const fakeFetch = async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    const adapter = createSaltoAdapter({
      providerType: 'salto_space_hospitality',
      baseUrl: 'https://space.example.test',
      bearerToken: 'server-only-token',
      probeRoomId: '101'
    }, fakeFetch);

    const readiness = await adapter.readiness(context);
    expect(calls[0]).toBe('https://space.example.test/v1/rooms/101/keys');
    expect(readiness.state).toBe('degraded');
    expect(readiness.blocker).toBe('salto_space_issue_contract_unverified');
  });

  it('fails SALTO Space issuance closed until the exact vendor request schema is verified', async () => {
    const adapter = createSaltoAdapter({
      providerType: 'salto_space_hospitality',
      baseUrl: 'https://space.example.test',
      bearerToken: 'server-only-token',
      probeRoomId: '101'
    }, async () => new Response('{}', { status: 200 }));

    await expect(adapter.issueCredential(context, issueRequest)).rejects.toThrow('provider_not_ready');
  });

  it('verifies a configured SALTO KS site but blocks room-key semantics that are not mapped', async () => {
    const fakeFetch = async () => new Response(JSON.stringify([{ id: 'site-1' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

    const adapter = createSaltoAdapter({
      providerType: 'salto_ks',
      baseUrl: 'https://ks.example.test',
      bearerToken: 'server-only-token',
      siteId: 'site-1'
    }, fakeFetch);

    const readiness = await adapter.readiness(context);
    expect(readiness.state).toBe('degraded');
    expect(readiness.blocker).toBe('salto_ks_room_credential_mapping_required');
  });

  it('normalizes unreachable SALTO providers to offline without exposing secrets', async () => {
    const adapter = createSaltoAdapter({
      providerType: 'salto_ks',
      baseUrl: 'https://ks.example.test',
      bearerToken: 'server-only-token',
      siteId: 'site-1'
    }, async () => { throw new Error('network failure with secret server-only-token'); });

    const readiness = await adapter.readiness(context);
    expect(readiness.state).toBe('offline');
    expect(JSON.stringify(readiness)).not.toContain('server-only-token');
  });
});

describe('ATLAS Hospitality Vingcard adapter', () => {
  it('fails closed when the property has no official VConnect/Vostio/Visionline interface', async () => {
    const adapter = createVingcardAdapter({
      providerType: 'vingcard_vconnect',
      officialInterfaceConfigured: false
    });

    const readiness = await adapter.readiness(context);
    expect(readiness.state).toBe('configured_unverified');
    expect(readiness.blocker).toBe('official_provider_interface_required');
    await expect(adapter.issueCredential(context, issueRequest)).rejects.toThrow('provider_not_ready');
  });
});

describe('ATLAS Hospitality dormakaba/Saflok adapter', () => {
  it('fails closed when the property has no official Ambiance/PMS interface', async () => {
    const adapter = createDormakabaAdapter({
      providerType: 'dormakaba_ambiance_cloud',
      officialInterfaceConfigured: false
    });

    const readiness = await adapter.readiness(context);
    expect(readiness.state).toBe('configured_unverified');
    expect(readiness.blocker).toBe('official_provider_interface_required');
    await expect(adapter.issueCredential(context, issueRequest)).rejects.toThrow('provider_not_ready');
  });
});
