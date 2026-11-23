import { describe, expect, it } from 'vitest';
import {
  admitSpatialRequest, generateSpatialObjPreview, parseSpatialPrimitive,
  MAX_SPATIAL_IMAGES, MAX_SPATIAL_IMAGE_BYTES, type SpatialAuthority, type SpatialRequest
} from '../../packages/creator/spatial_forge';

const authority: SpatialAuthority = {
  tenantId: 'tenant-a', orgId: 'org-a', actorId: 'actor-a',
  hasGeneratePermission: true, nativePreviewVerified: true
};
const textRequest = (prompt: string): SpatialRequest => ({
  source: { kind: 'text', prompt }, format: 'obj', material: 'none', quality: 'preview'
});
const image = (n: number) => ({ name: 'ref' + n + '.jpg', type: 'image/jpeg', size: 1500 });

describe('ATLAS Spatial Forge 777 fail-closed admission', () => {
  it('requires scope, permission and verified local preview', () => {
    expect(admitSpatialRequest(textRequest('cube'), { ...authority, orgId: '' }))
      .toEqual({ allowed: false, reason: 'invalid_tenant_scope' });
    expect(admitSpatialRequest(textRequest('cube'), { ...authority, hasGeneratePermission: false }))
      .toEqual({ allowed: false, reason: 'permission_denied' });
    expect(admitSpatialRequest(textRequest('cube'), { ...authority, nativePreviewVerified: false }))
      .toEqual({ allowed: false, reason: 'native_engine_unverified' });
  });

  it('does not claim AI mesh synthesis, premium formats, textures or quality', () => {
    expect(admitSpatialRequest(textRequest('cubo'), authority))
      .toEqual({ allowed: true, execution: 'atlas-procedural-preview', billable: false });
    expect(admitSpatialRequest(textRequest('a lifelike building'), authority))
      .toEqual({ allowed: false, reason: 'unsupported_native_preview' });
    expect(admitSpatialRequest({ ...textRequest('cube'), format: 'glb' }, authority))
      .toEqual({ allowed: false, reason: 'unsupported_native_preview' });
    expect(admitSpatialRequest({ ...textRequest('cube'), material: 'pbr' }, authority))
      .toEqual({ allowed: false, reason: 'unsupported_native_preview' });
    expect(admitSpatialRequest({ ...textRequest('cube'), quality: 'high' }, authority))
      .toEqual({ allowed: false, reason: 'unsupported_native_preview' });
    expect(admitSpatialRequest(textRequest(' '), authority))
      .toEqual({ allowed: false, reason: 'invalid_prompt' });
    expect(admitSpatialRequest(textRequest('x'.repeat(1025)), authority))
      .toEqual({ allowed: false, reason: 'invalid_prompt' });
  });

  it('validates images without pretending an image-to-mesh engine is installed', () => {
    const request: SpatialRequest = {
      source: { kind: 'images', images: [image(1)] },
      format: 'obj', material: 'none', quality: 'preview'
    };
    expect(admitSpatialRequest(request, authority))
      .toEqual({ allowed: false, reason: 'neural_engine_unavailable' });
    expect(admitSpatialRequest({
      ...request,
      source: { kind: 'images', images: Array.from({ length: MAX_SPATIAL_IMAGES + 1 }, (_, i) => image(i)) }
    }, authority)).toEqual({ allowed: false, reason: 'invalid_images' });
    expect(admitSpatialRequest({
      ...request,
      source: { kind: 'images', images: [{ ...image(1), size: MAX_SPATIAL_IMAGE_BYTES + 1 }] }
    }, authority)).toEqual({ allowed: false, reason: 'invalid_images' });
    expect(admitSpatialRequest({
      ...request,
      source: { kind: 'images', images: [{ ...image(1), type: 'image/svg+xml' }] }
    }, authority)).toEqual({ allowed: false, reason: 'invalid_images' });
    expect(admitSpatialRequest({
      ...request,
      source: { kind: 'images', images: [image(1)], prompt: 'x'.repeat(1025) }
    }, authority)).toEqual({ allowed: false, reason: 'invalid_images' });
  });

  it('checks uploaded mesh metadata, but does not claim conversion or rigging', () => {
    const request: SpatialRequest = {
      source: { kind: 'model', model: { name: 'mesh.glb', type: 'model/gltf-binary', size: 900 } },
      format: 'obj', material: 'none', quality: 'preview'
    };
    expect(admitSpatialRequest(request, authority))
      .toEqual({ allowed: false, reason: 'neural_engine_unavailable' });
    expect(admitSpatialRequest({
      ...request,
      source: { kind: 'model', model: { name: 'bad.exe', type: 'application/octet-stream', size: 900 } }
    }, authority)).toEqual({ allowed: false, reason: 'invalid_model' });
  });
});

describe('ATLAS original native OBJ geometry', () => {
  it('recognizes only four named shapes, including Spanish aliases', () => {
    expect(parseSpatialPrimitive('  PIRÁMIDE ')).toBe('pyramid');
    expect(parseSpatialPrimitive('esfera')).toBe('sphere');
    expect(parseSpatialPrimitive('cilindro')).toBe('cylinder');
    expect(parseSpatialPrimitive('cubo')).toBe('cube');
    expect(parseSpatialPrimitive('city')).toBeNull();
  });

  it.each(['cube', 'pyramid', 'cylinder', 'sphere'])('exports valid, deterministic, closed OBJ for %s', shape => {
    const result = generateSpatialObjPreview(textRequest(shape), authority);
    const vertices = result.content.split('\n').filter(line => line.startsWith('v '))
      .map(line => line.slice(2).split(' ').map(Number));
    const faces = result.content.split('\n').filter(line => line.startsWith('f '))
      .map(line => line.slice(2).split(' ').map(Number));
    expect(result.provenance).toBe('atlas-procedural-preview');
    expect(result.content).toContain('not AI-generated');
    expect(result.content).toBe(generateSpatialObjPreview(textRequest(shape), authority).content);
    expect(vertices).toHaveLength(result.vertexCount);
    expect(faces).toHaveLength(result.triangleCount);
    expect(faces.length).toBeGreaterThanOrEqual(6);
    const edges = new Map<string, number>();
    let signedVolume = 0;
    for (const vertex of vertices) expect(vertex.every(Number.isFinite)).toBe(true);
    for (const indices of faces) {
      expect(indices).toHaveLength(3);
      expect(new Set(indices).size).toBe(3);
      for (const index of indices) {
        expect(index).toBeGreaterThanOrEqual(1);
        expect(index).toBeLessThanOrEqual(vertices.length);
      }
      const [a, b, c] = indices.map(index => vertices[index - 1]);
      signedVolume += (
        a[0] * (b[1] * c[2] - b[2] * c[1]) -
        a[1] * (b[0] * c[2] - b[2] * c[0]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])
      ) / 6;
      for (let i = 0; i < 3; i++) {
        const key = [indices[i], indices[(i + 1) % 3]].sort((x, y) => x - y).join(':');
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
    expect(signedVolume).toBeGreaterThan(0);
    expect([...edges.values()].every(count => count === 2)).toBe(true);
  });

  it('rejects unauthorized or unrecognized exports', () => {
    expect(() => generateSpatialObjPreview(textRequest('sphere'), {
      ...authority, hasGeneratePermission: false
    })).toThrow('permission_denied');
    expect(() => generateSpatialObjPreview(textRequest('a cat'), authority))
      .toThrow('unsupported_native_preview');
  });
});
