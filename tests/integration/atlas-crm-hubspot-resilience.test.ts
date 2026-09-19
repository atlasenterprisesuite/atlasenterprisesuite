import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  normalizeHubSpotWebhookEvents,
  verifyHubSpotV3Signature
} from '../../supabase/functions/_shared/hubspot-webhook';

const migration = readFileSync(
  'supabase/migrations/20260919015000_crm_hubspot_resilience.sql',
  'utf8'
);
const manifest = JSON.parse(readFileSync(
  'hubspot/atlas-crm-hubspot/src/app/webhooks/atlas-crm-hubspot-webhooks-hsmeta.json',
  'utf8'
)) as {
  type: string;
  config: {
    settings: { targetUrl: string; maxConcurrentRequests: number };
    subscriptions: { crmObjects: Array<Record<string, unknown>> };
  };
};
const edge = readFileSync('supabase/functions/atlas-crm-hubspot/index.ts', 'utf8');
const operations = readFileSync('supabase/functions/_shared/hubspot-crm-operations.ts', 'utf8');

describe('ATLAS CRM HubSpot resilience contract', () => {
  it('verifies fresh HubSpot v3 signatures and rejects stale requests', async () => {
    const secret = 'hubspot-test-client-secret';
    const method = 'POST';
    const uri = 'https://atlas.test/functions/v1/atlas-crm-hubspot';
    const rawBody = JSON.stringify([{ eventId: 1, portalId: 247228429 }]);
    const timestamp = String(Date.parse('2026-09-19T05:00:00Z'));
    const signature = createHmac('sha256', secret)
      .update(`${method}${uri}${rawBody}${timestamp}`)
      .digest('base64');

    await expect(verifyHubSpotV3Signature({
      method,
      uri,
      rawBody,
      signature,
      timestamp,
      clientSecret: secret,
      now: Date.parse('2026-09-19T05:02:00Z')
    })).resolves.toBe(true);

    await expect(verifyHubSpotV3Signature({
      method,
      uri,
      rawBody,
      signature,
      timestamp,
      clientSecret: secret,
      now: Date.parse('2026-09-19T05:06:00Z')
    })).resolves.toBe(false);
  });

  it('normalizes only safe webhook metadata and drops property values', async () => {
    const events = await normalizeHubSpotWebhookEvents(JSON.stringify([{
      eventId: 991,
      subscriptionType: 'object.propertyChange',
      portalId: 247228429,
      objectId: 1234,
      objectTypeId: '0-1',
      propertyName: 'email',
      propertyValue: 'sensitive@example.test',
      occurredAt: Date.parse('2026-09-19T05:00:00Z')
    }]));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      providerEventId: '991',
      providerAccountId: '247228429',
      providerObjectType: 'contact',
      providerObjectId: '1234',
      propertyName: 'email'
    });
    expect(JSON.stringify(events)).not.toContain('sensitive@example.test');
  });

  it('configures signed realtime webhooks for the four production smoke objects', () => {
    expect(manifest.type).toBe('webhooks');
    expect(manifest.config.settings).toEqual({
      targetUrl: 'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-crm-hubspot',
      maxConcurrentRequests: 10
    });
    const subscriptions = manifest.config.subscriptions.crmObjects;
    for (const objectType of ['contact', 'company', 'deal', 'ticket']) {
      expect(subscriptions).toEqual(expect.arrayContaining([
        expect.objectContaining({ subscriptionType: 'object.creation', objectType, active: true }),
        expect.objectContaining({ subscriptionType: 'object.deletion', objectType, active: true }),
        expect.objectContaining({ subscriptionType: 'object.propertyChange', objectType, active: true })
      ]));
    }
  });

  it('persists only safe health/webhook metadata and schedules an hourly fail-closed monitor', () => {
    expect(migration).toContain('create table if not exists public.atlas_integration_health');
    expect(migration).toContain('create table if not exists public.atlas_integration_webhook_events');
    expect(migration).not.toMatch(/atlas_integration_webhook_events[\s\S]{0,1000}\bpayload\b/i);
    expect(migration).toContain('atlas_hubspot_monitor_trigger_v1');
    expect(migration).toContain('validate_atlas_hubspot_monitor_trigger');
    expect(migration).toContain("'23 * * * *'");
    expect(migration).toContain("'x-atlas-hubspot-monitor-token'");
  });

  it('keeps webhook and monitor authorization outside normal user operations', () => {
    expect(edge).toContain('verifyHubSpotV3Signature');
    expect(edge).toContain('validateInternalMonitorToken');
    expect(edge).toContain("body.operation === 'internal.monitor'");
    expect(edge).toContain("'connection.health'");
  });

  it('fails closed on outbound CRM writes unless an explicit server policy enables them', () => {
    expect(operations).toContain('input.deps.writesEnabled !== true');
    expect(operations).toContain('crm_writes_disabled');
    expect(edge).toContain("HUBSPOT_CRM_WRITES_ENABLED");
  });
});
