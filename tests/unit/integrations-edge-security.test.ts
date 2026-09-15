import { describe, expect, it, vi } from 'vitest';
import { resolveIntegrationContext } from '../../supabase/functions/_shared/integrations/context';
import { requireApprovalIfConfigured } from '../../supabase/functions/_shared/integrations/approval';
import { assertAuditMetadataSafe } from '../../supabase/functions/_shared/integrations/audit';
import { storeCredentialSecret } from '../../supabase/functions/_shared/integrations/vault';

const supabaseUrl = 'https://atlas.example.test';
const publishableKey = 'publishable-test-key';

function req(orgId?: string) {
  const headers = new Headers({ authorization: 'Bearer atlas-user-token' });
  if (orgId) headers.set('x-atlas-org-id', orgId);
  return new Request('https://atlas.example.test/functions/v1/atlas-integrations', { headers });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

describe('Connected Apps Edge authentication context', () => {
  it('requires a bearer token', async () => {
    await expect(resolveIntegrationContext(
      new Request('https://atlas.example.test/functions/v1/atlas-integrations'),
      { supabaseUrl, publishableKey, fetchFn: vi.fn() }
    )).rejects.toMatchObject({ code: 'authentication_required', status: 401 });
  });

  it('requires active organization membership', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(json({ id: 'user-1' }))
      .mockResolvedValueOnce(json([]));

    await expect(resolveIntegrationContext(req(), { supabaseUrl, publishableKey, fetchFn }))
      .rejects.toMatchObject({ code: 'active_organization_required', status: 403 });
  });

  it('loads permissions from identity_role_permissions and uses organization-scoped tenancy', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(json({ id: 'user-1' }))
      .mockResolvedValueOnce(json([{ org_id: 'org-1', role: 'owner', status: 'active' }]))
      .mockResolvedValueOnce(json([
        { permission_code: 'integrations.view' },
        { permission_code: 'integrations.use' }
      ]));

    const context = await resolveIntegrationContext(req('org-1'), { supabaseUrl, publishableKey, fetchFn });
    expect(context).toMatchObject({
      tenantId: 'org-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      permissions: ['integrations.view', 'integrations.use']
    });
    expect(String(fetchFn.mock.calls[2][0])).toContain('identity_role_permissions');
  });

  it('rejects a requested organization outside the active memberships', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(json({ id: 'user-1' }))
      .mockResolvedValueOnce(json([{ org_id: 'org-1', role: 'owner', status: 'active' }]));

    await expect(resolveIntegrationContext(req('org-2'), { supabaseUrl, publishableKey, fetchFn }))
      .rejects.toMatchObject({ code: 'organization_membership_required', status: 403 });
  });
});

describe('Connected Apps secret and audit boundaries', () => {
  it('rejects raw secret-shaped audit metadata', () => {
    expect(() => assertAuditMetadataSafe({ refresh_token: 'super-secret-refresh-token' }))
      .toThrow('unsafe_audit_payload');
    expect(() => assertAuditMetadataSafe({ credential_ref: 'opaque-uuid', provider_error_code: 'invalid_grant' }))
      .not.toThrow();
  });

  it('fails closed when credential encryption/storage is not configured without echoing the secret', async () => {
    const secret = 'super-secret-refresh-token';
    let error: unknown;
    try {
      await storeCredentialSecret({
        organizationId: 'org-1',
        provider: 'microsoft',
        credentialKind: 'oauth_tokens',
        secretValue: secret
      }, {
        supabaseUrl,
        serviceRoleKey: '',
        encryptionKey: '',
        fetchFn: vi.fn()
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: 'credential_vault_not_configured', status: 503 });
    expect(JSON.stringify(error)).not.toContain(secret);
  });
});

describe('Connected Apps approval boundary', () => {
  it('passes non-sensitive operations without fabricating an approval id', async () => {
    await expect(requireApprovalIfConfigured({ requiresApproval: false }, { operation: 'verify' }))
      .resolves.toEqual({ approved: true, approvalId: null });
  });

  it('fails closed when approval is required but no real adapter exists', async () => {
    await expect(requireApprovalIfConfigured({ requiresApproval: true }, { operation: 'production-secret-rotation' }))
      .rejects.toMatchObject({ code: 'approval_required', status: 409 });
  });
});
