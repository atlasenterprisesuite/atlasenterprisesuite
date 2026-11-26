import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { exportCreatorSpatialPreview } from '../../apps/web/src/lib/creatorApi';

const edge = readFileSync(resolve(process.cwd(), 'supabase/functions/atlas-creator/index.ts'), 'utf8');
const creator = readFileSync(resolve(process.cwd(), 'apps/web/src/lib/creatorApi.ts'), 'utf8');

describe('ATLAS Spatial Forge Creator Edge integration source contract', () => {
  it('routes only POST through the existing protected Creator API', () => {
    expect(edge).toContain("if (api === 'spatial-preview' && req.method === 'POST') return handleSpatialPreview(req);");
    expect(edge).toContain("async function handleSpatialPreview(req: Request)");
    expect(edge).toContain("await creatorContext(req, 'creator.generate')");
    expect(edge).toContain("await writeCreatorAudit(ctx.orgId, ctx.userId, 'creator.spatial.previewed'");
  });

  it('never treats client-supplied identity, billing or engine flags as authority', () => {
    const handler = edge.split('async function handleSpatialPreview(req: Request)')[1]
      ?.split('\nasync function ')[0] || '';
    expect(handler).toContain('ctx.orgId');
    expect(handler).toContain('ctx.userId');
    expect(handler).toContain('generateSpatialObjPreview(');
    expect(handler).not.toContain('body.tenantId');
    expect(handler).not.toContain('body.orgId');
    expect(handler).not.toContain('body.actorId');
    expect(handler).not.toContain('body.nativePreviewVerified');
    expect(handler).not.toContain('body.approvedSpendCents');
    expect(handler).not.toContain('fetch(');
    expect(handler).toContain("spatial_request_too_large");
    expect(handler).toContain('maxPayloadBytes = 2048');
    expect(handler).toContain('reader.read()');
    expect(handler).toContain("Object.keys(decoded).length !== 1");
  });

  it('declares the response as a transient procedural model, never a saved neural asset', () => {
    const handler = edge.split('async function handleSpatialPreview(req: Request)')[1]
      ?.split('\nasync function ')[0] || '';
    expect(handler).toContain("provenance: result.provenance");
    expect(handler).toContain('obj_content: result.content');
    expect(handler).not.toContain('signed_url');
    expect(handler).not.toContain('generation_job_id');
    expect(handler).not.toContain('creator_assets');
    expect(creator).toContain("creatorRequest<SpatialPreviewResponse>('spatial-preview'");
  });
});

describe('ATLAS Spatial Forge browser bridge', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('atlas_access_token', 'test-token');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('transmits only the primitive via authenticated POST to Creator', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      file_name: 'atlas_cube.obj',
      mime_type: 'model/obj',
      provenance: 'atlas-procedural-preview',
      primitive: 'cube',
      vertex_count: 8,
      triangle_count: 12,
      obj_content: 'o atlas_cube\n'
    }), {status: 200}));
    vi.stubGlobal('fetch', fetchMock);
    const result = await exportCreatorSpatialPreview('cube');
    expect(result.provenance).toBe('atlas-procedural-preview');
    expect(result.obj_content).toContain('atlas_cube');
    const [url,init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/functions/v1/atlas-creator?api=spatial-preview');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string,string>).authorization).toBe('Bearer test-token');
    expect(JSON.parse(String(init.body))).toEqual({prompt:'cube'});
  });
});
