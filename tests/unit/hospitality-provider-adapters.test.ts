import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const saltoPath = resolve(process.cwd(), 'supabase/functions/atlas-hospitality-access/providers/salto.ts');

async function loadSaltoModule() {
  expect(existsSync(saltoPath)).toBe(true);
  return import(/* @vite-ignore */ pathToFileURL(saltoPath).href);
}

const context = {
  organizationId: 'org-1',
  propertyId: 'hotel-1',
  userId: 'user-1',
  providerInstanceId: 'provider-1',
  providerPropertyId: 'site-1'
};

describe('ATLAS Hospitality SALTO adapters', () => {
  it('verifies SALTO Space connectivity without claiming issuance is complete', async () => {
    const { createSaltoAdapter } = await loadSaltoModule();
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
    const { createSaltoAdapter } = await loadSaltoModule();
    const adapter = createSaltoAdapter({
      providerType: 'salto_space_hospitality',
      baseUrl: 'https://space.example.test',
      bearerToken: 'server-only-token',
      probeRoomId: '101'
    }, async () => new Response('{}', { status: 200 }));

    await expect(adapter.issueCredential(context, {
      propertyId: 'hotel-1',
      roomId: '101',
      providerRoomId: '101',
      assignmentReference: 'reservation-1',
      startsAt: '2026-09-11T20:00:00.000Z',
      expiresAt: '2026-09-12T15:00:00.000Z',
      reason: 'guest_checkin',
      credentialType: 'mobile_key'
    })).rejects.toThrow('provider_not_ready');
  });

  it('verifies a configured SALTO KS site but blocks room-key semantics that are not mapped', async () => {
    const { createSaltoAdapter } = await loadSaltoModule();
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
    const { createSaltoAdapter } = await loadSaltoModule();
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
