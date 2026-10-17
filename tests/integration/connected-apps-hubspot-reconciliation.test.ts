import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const bridge = readFileSync('supabase/functions/_shared/connected-apps/hubspot-adapter.ts', 'utf8');
const lifecycle = readFileSync('supabase/functions/_shared/hubspot-connection-lifecycle.ts', 'utf8');

describe('Connected Apps HubSpot reconciliation', () => {
  it('reuses the existing lifecycle instead of duplicating credentials or OAuth state', () => {
    expect(bridge).toContain('prepareHubSpotConnection');
    expect(bridge).toContain('completeHubSpotConnection');
    expect(bridge).toContain('disconnectHubSpotConnection');
    expect(bridge).toContain('HubSpot');
    expect(bridge).not.toContain('atlas_integration_credentials');
    expect(bridge).not.toContain('atlas_oauth_states');
  });

  it('keeps one canonical HubSpot provider identity and scope source', () => {
    expect(lifecycle).toContain("provider: 'hubspot'");
    expect(lifecycle).toContain('HUBSPOT_P0_SCOPES');
    expect(bridge).toContain('HUBSPOT_P0_SCOPES');
  });
});
