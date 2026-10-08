import { describe, expect, it } from 'vitest';
import { normalizeConnectedAppsResponse } from '../../apps/web/src/lib/connectedAppsApi';

describe('Connected Apps web API normalization', () => {
  it('preserves safe connection metadata and strips secret-like fields recursively', () => {
    const value = normalizeConnectedAppsResponse({
      ok: true,
      connections: [{
        id: 'c1', provider: 'hubspot', state: 'connected', provider_account_label: 'Workspace',
        access_token: 'secret', nested: { refresh_token: 'refresh', safe: 'yes' }
      }]
    }) as Record<string, any>;
    const serialized = JSON.stringify(value);
    expect(serialized).toContain('Workspace');
    expect(serialized).toContain('yes');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('refresh');
  });

  it('normalizes legacy unconfigured to disconnected for UI truth', () => {
    const value = normalizeConnectedAppsResponse({ connections: [{ id: 'c1', state: 'unconfigured' }] }) as Record<string, any>;
    expect(value.connections[0].state).toBe('disconnected');
  });
});
