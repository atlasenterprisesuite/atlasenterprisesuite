import { describe, expect, it, vi } from 'vitest';
import { createAtlasAgenticCore, computeExternalActionDigest } from '../../supabase/functions/atlas-copilot/agentic-core.mjs';

const args = { organization_id: 'org-1', profile_id: 'public-example' };
const context = () => ({
  organization_id: 'org-1', user_id: 'owner-1',
  permissions: ['social.read'], roles: ['owner'],
  session_id: 'session-1', request_id: 'request-1'
});

function setup(resolveExternalConsent?: (input: any) => unknown, permission = ['social.read']) {
  const events: Array<Record<string, unknown>> = [];
  const audit = { append: (event: Record<string, unknown>) => events.push(event) };
  const approvals = { list: () => [{
    id: 'approval-1', status: 'approved',
    subject_type: 'agent_tool', subject_id: 'social.read'
  }] };
  const core = createAtlasAgenticCore({ approvals, audit, resolveExternalConsent });
  const handler = vi.fn(async () => ({ ok: true }));
  const tool = core.registry.register({
    name: 'social.read', module: 'research', operation: 'READ',
    risk_level: 'LOW', permission: 'social.read',
    external_access: {
      provider: 'agent-reach', capability: 'social.profile.read', action: 'read'
    },
    handler
  });
  return { core, tool, handler, events, context: { ...context(), permissions: permission } };
}

function grant(payloadDigest: string, overrides: Record<string, unknown> = {}) {
  return {
    status: 'approved', source: 'interactive_owner',
    owner_verified: true, tenant_verified: true,
    owner_user_id: 'owner-1', organization_id: 'org-1',
    approval_id: 'approval-1', provider: 'agent-reach',
    capability: 'social.profile.read', action: 'read',
    payload_digest: payloadDigest,
    expires_at: '2099-01-01T00:00:00.000Z', revoked_at: null,
    ...overrides
  };
}

const invoke = (x: ReturnType<typeof setup>, operationArgs: Record<string, unknown> = args,
  inputContext: Record<string, unknown> = x.context) =>
  x.core.dispatcher.execute({
    context: inputContext, tool_name: 'social.read',
    arguments: operationArgs, approval_id: 'approval-1'
  });

describe('external agent owner consent — fail closed', () => {
  it('requires a canonical execution approval even for read-only external tools', async () => {
    const x = setup();
    expect(x.tool.requires_approval).toBe(true);
    await expect(x.core.dispatcher.execute({
      context: x.context, tool_name: 'social.read', arguments: args
    })).rejects.toMatchObject({ code: 'approval_required' });
    expect(x.handler).not.toHaveBeenCalled();
  });

  it('rejects external access when no server-side consent resolver exists', async () => {
    const x = setup();
    await expect(invoke(x)).rejects.toMatchObject({ code: 'owner_consent_required' });
    expect(x.handler).not.toHaveBeenCalled();
  });

  it('allows an exact approved owner grant from the trusted resolver', async () => {
    const x = setup(({ payloadDigest }: { payloadDigest: string }) => grant(payloadDigest));
    await expect(invoke(x)).resolves.toEqual({ ok: true });
    expect(x.handler).toHaveBeenCalledOnce();
  });

  it.each([
    ['rejected', { status: 'rejected' }],
    ['revoked', { revoked_at: '2026-11-06T00:00:00Z' }],
    ['expired', { expires_at: '2020-01-01T00:00:00Z' }],
    ['different owner', { owner_user_id: 'other' }],
    ['unverified owner', { owner_verified: false }],
    ['unverified tenant', { tenant_verified: false }],
    ['different tenant', { organization_id: 'org-2' }],
    ['other provider', { provider: 'other-provider' }],
    ['other capability', { capability: 'social.post' }],
    ['other action', { action: 'publish' }],
    ['other approval', { approval_id: 'approval-2' }],
    ['untrusted source', { source: 'prompt' }],
    ['other digest', { payload_digest: 'f'.repeat(64) }]
  ])('rejects %s consent despite an otherwise approved execution', async (_label, overrides) => {
    const x = setup(({ payloadDigest }: { payloadDigest: string }) => grant(payloadDigest, overrides));
    await expect(invoke(x)).rejects.toMatchObject({ code: 'owner_consent_required' });
    expect(x.handler).not.toHaveBeenCalled();
  });

  it('binds consent to the full immutable action payload, regardless of key order', async () => {
    const digest = await computeExternalActionDigest({
      external_access: { provider: 'agent-reach', capability: 'social.profile.read', action: 'read' }
    }, args);
    const reversed = await computeExternalActionDigest({
      external_access: { provider: 'agent-reach', capability: 'social.profile.read', action: 'read' }
    }, { profile_id: 'public-example', organization_id: 'org-1' });
    expect(reversed).toBe(digest);
    const x = setup(() => grant(digest));
    await expect(invoke(x, { ...args, profile_id: 'another-profile' }))
      .rejects.toMatchObject({ code: 'owner_consent_required' });
    expect(x.handler).not.toHaveBeenCalled();
  });

  it('ignores fabricated user-supplied approval data and preserves permission denial', async () => {
    const x = setup(({ payloadDigest }: { payloadDigest: string }) => grant(payloadDigest), []);
    await expect(invoke(x, args, {
      ...x.context,
      owner_consent: { status: 'approved', owner_verified: true }
    })).rejects.toMatchObject({ code: 'permission_denied' });
    expect(x.handler).not.toHaveBeenCalled();
  });

  it('denies when the trusted consent resolver throws and logs no secret payload', async () => {
    const x = setup(() => { throw new Error('backend unavailable'); });
    await expect(invoke(x, { ...args, access_token: 'SENSITIVE-NEVER-LOG' }))
      .rejects.toMatchObject({ code: 'owner_consent_required' });
    expect(x.handler).not.toHaveBeenCalled();
    expect(JSON.stringify(x.events)).not.toContain('SENSITIVE-NEVER-LOG');
    expect(JSON.stringify(x.events)).toContain('owner_consent_required');
  });

  it('refuses invalid external provider registration before accepting a handler', () => {
    const x = setup();
    expect(() => x.core.registry.register({
      name: 'invalid.external', module: 'research', operation: 'READ',
      permission: 'social.read', external_access: { provider: '', action: 'read' },
      handler: vi.fn()
    })).toThrow('external_provider_required');
  });
});
