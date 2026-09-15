import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { executeIntegrationCapability } from '../../supabase/functions/atlas-copilot/integration-capability.mjs';

function request() {
  return new Request('https://example.supabase.co/functions/v1/atlas-copilot?api=chat', {
    method: 'POST',
    headers: {
      authorization: 'Bearer atlas-user-token',
      apikey: 'public-key',
      'x-atlas-org-id': 'org-1',
      'x-request-id': 'request-1'
    }
  });
}

describe('ATLAS Assistant integration capability boundary', () => {
  it('returns a structured blocked state when the Integration Gateway denies the capability', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      error: 'integration_grant_missing'
    }), { status: 409, headers: { 'content-type': 'application/json' } }));

    const result = await executeIntegrationCapability({
      request: request(),
      organizationId: 'org-1',
      module: 'assistant',
      capability: 'microsoft.profile.read',
      fetchFn
    });

    expect(result).toEqual({
      ok: false,
      capability: 'microsoft.profile.read',
      data: null,
      blocked_reason: 'integration_grant_missing',
      connection_state: null
    });
  });

  it('returns sanitized provider data only and forwards the ATLAS bearer context', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      capability: 'microsoft.profile.read',
      data: { id: 'subject-1', displayName: 'Atlas User', maskedIdentity: 'w***u@hotmail.com' }
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const result = await executeIntegrationCapability({
      request: request(),
      organizationId: 'org-1',
      module: 'assistant',
      capability: 'microsoft.profile.read',
      fetchFn
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ id: 'subject-1', displayName: 'Atlas User', maskedIdentity: 'w***u@hotmail.com' });
    const [, init] = fetchFn.mock.calls[0];
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer atlas-user-token');
    expect(new Headers(init.headers).get('x-atlas-org-id')).toBe('org-1');
  });

  it('rejects a provider response that attempts to cross a token or secret into Assistant runtime', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      capability: 'microsoft.profile.read',
      data: { displayName: 'Atlas User', access_token: 'secret-token' }
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(executeIntegrationCapability({
      request: request(),
      organizationId: 'org-1',
      module: 'assistant',
      capability: 'microsoft.profile.read',
      fetchFn
    })).rejects.toMatchObject({ code: 'integration_secret_boundary_violation' });
  });

  it('cannot request a broader capability or scope expansion through the Assistant bridge', async () => {
    const fetchFn = vi.fn();
    await expect(executeIntegrationCapability({
      request: request(),
      organizationId: 'org-1',
      module: 'assistant',
      capability: 'microsoft.mail.read',
      fetchFn
    })).rejects.toMatchObject({ code: 'integration_capability_not_allowed' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('binds the bridge into atlas-copilot without inserting provider credentials into model content', () => {
    const source = readFileSync('supabase/functions/atlas-copilot/index.ts', 'utf8');
    expect(source).toContain("from './integration-capability.mjs'");
    expect(source).toContain('integration_capability');
    expect(source).toContain('executeIntegrationCapability');
    expect(source).not.toMatch(/integration_result[\s\S]{0,400}(access_token|refresh_token|client_secret)/i);
  });
});
