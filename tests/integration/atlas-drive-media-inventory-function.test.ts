import { describe, expect, it } from 'vitest';
import {
  handleDriveMediaInventoryRequest,
  type DriveMediaEdgeDependencies
} from '../../supabase/functions/atlas-drive-media-inventory/index';

const orgA = '11111111-1111-4111-8111-111111111111';
const orgB = '22222222-2222-4222-8222-222222222222';
const user = '33333333-3333-4333-8333-333333333333';
const asset = {
  organizationId: orgA,
  driveFileId: 'synthetic_drive_id_a1',
  name: 'cover.png',
  mimeType: 'image/png',
  sha256: 'a'.repeat(64),
  collection: 'production-covers'
};

function backend(input: {
  validSession?: boolean;
  allowedOrg?: string | null;
  rpcDown?: boolean;
  calls?: Array<{ url: string; body: string | undefined }>;
} = {}): DriveMediaEdgeDependencies {
  return {
    env: (name) => ({
      SUPABASE_URL: 'https://atlas-test.supabase.co',
      SUPABASE_ANON_KEY: 'synthetic-publishable-key'
    } as Record<string, string>)[name],
    fetchImpl: async (resource, options) => {
      const url = String(resource);
      input.calls?.push({ url, body: options?.body?.toString() });
      if (url.endsWith('/auth/v1/user')) {
        return input.validSession === false
          ? new Response('{}', { status: 401 })
          : new Response(JSON.stringify({ id: user }), { status: 200 });
      }
      if (url.endsWith('/rest/v1/rpc/has_identity_permission')) {
        if (input.rpcDown) return new Response('{}', { status: 503 });
        const body = JSON.parse(String(options?.body)) as { o: string; p: string };
        const allowed = body.o === (input.allowedOrg === undefined ? orgA : input.allowedOrg) &&
          body.p === 'integrations.write';
        return new Response(JSON.stringify(allowed), { status: 200 });
      }
      throw new Error('Unexpected network target');
    }
  };
}

async function invoke(
  input: Record<string, unknown> = asset,
  deps: DriveMediaEdgeDependencies = backend(),
  opts: { token?: string | null; origin?: string | null; method?: string } = {}
) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (opts.token !== null) headers.set('Authorization', 'Bearer ' + (opts.token ?? 'synthetic-session'));
  if (opts.origin !== null) headers.set('Origin', opts.origin ?? 'https://atlasenterprisesuite.com');
  const method = opts.method ?? 'POST';
  const req = new Request('https://atlas-test.supabase.co/functions/v1/atlas-drive-media-inventory', {
    method, headers, body: method === 'POST' ? JSON.stringify(input) : undefined
  });
  return handleDriveMediaInventoryRequest(req, deps);
}

describe('ATLAS Drive media authenticated HTTP boundary — fail closed', () => {
  it('validates a permitted org without storing or publishing source metadata', async () => {
    const calls: Array<{ url: string; body: string | undefined }> = [];
    const response = await invoke(asset, backend({ calls }));
    expect(response.status).toBe(200);
    const data = await response.json() as Record<string, unknown>;
    expect(data).toMatchObject({
      status: 'validated_only', publishable: false, rightsStatus: 'unverified',
      reviewStatus: 'pending', sensitivity: 'restricted'
    });
    expect(data).not.toHaveProperty('driveFileId');
    expect(data).not.toHaveProperty('sha256');
    expect(calls.map(call => call.url)).toEqual([
      'https://atlas-test.supabase.co/auth/v1/user',
      'https://atlas-test.supabase.co/rest/v1/rpc/has_identity_permission'
    ]);
  });

  it('denies unauthenticated, expired, revoked and cross-organization sessions', async () => {
    expect((await invoke(asset, backend(), { token: null })).status).toBe(401);
    expect((await invoke(asset, backend({ validSession: false }))).status).toBe(401);
    expect((await invoke(asset, backend({ allowedOrg: null }))).status).toBe(403);
    expect((await invoke({ ...asset, organizationId: orgB }, backend())).status).toBe(403);
    expect((await invoke(asset, backend({ rpcDown: true }))).status).toBe(503);
  });

  it('rejects forged tenant, permission and actor identity claims', async () => {
    for (const forged of [
      { scope: { tenantId: orgB, organizationId: orgA } },
      { tenantId: orgB },
      { actor: { permissions: ['integrations.admin'] } },
      { permissions: ['integrations.admin'] }
    ]) {
      expect((await invoke({ ...asset, ...forged })).status).toBe(400);
    }
  });

  it('never promotes a caller rights claim or review flag to publication authorization', async () => {
    const response = await invoke({
      ...asset,
      publishable: true,
      visualReviewed: true,
      permissionReviewed: true,
      rightsStatus: 'approved'
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      publishable: false, rightsStatus: 'unverified', reviewStatus: 'pending'
    });
  });

  it('fails closed for unsupported media, invalid SHA, invalid org, and missing config', async () => {
    expect((await invoke({ ...asset, mimeType: 'text/html' })).status).toBe(400);
    expect((await invoke({ ...asset, sha256: 'not-a-hash' })).status).toBe(400);
    expect((await invoke({ ...asset, organizationId: 'invalid' })).status).toBe(400);
    expect((await invoke({ ...asset, collection: 'arbitrary-source' })).status).toBe(400);
    expect((await invoke({ ...asset, name: { forged: 'name' } })).status).toBe(400);
    expect((await invoke(asset, { env: () => undefined })).status).toBe(503);
  });

  it('restricts browser origins and methods', async () => {
    const denied = await invoke(asset, backend(), { origin: 'https://hostile.example' });
    expect(denied.status).toBe(403);
    const allowed = await invoke(asset, backend(), { method: 'OPTIONS' });
    expect(allowed.status).toBe(204);
    const wrongMethod = await invoke(asset, backend(), { method: 'GET' });
    expect(wrongMethod.status).toBe(405);
  });
});
