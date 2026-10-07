import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routes = readFileSync('apps/web/src/modules/cloud/AtlasCloudRoutes.tsx', 'utf8');
const next = readFileSync('apps/web/src/modules/cloud/AtlasCloudNextLevel.tsx', 'utf8');
const hub = readFileSync('apps/web/src/modules/cloud/AtlasCloudReleaseOperations.tsx', 'utf8');

describe('ATLAS Cloud Release & Operations convergence', () => {
  it('uses one Cloud entry surface for release, readiness and production verification', () => {
    expect(routes).toContain('/cloud/operations');
    expect(routes).toContain('AtlasCloudReleaseOperations');
    expect(next).toContain('to="/cloud/operations">Release & Operations</Link>');
    expect(next).not.toContain('>Releases</Link>');
    expect(next).not.toContain('>Production Verify</Link>');
  });

  it('preserves all canonical deep links behind the converged hub', () => {
    for (const route of [
      '/cloud/releases',
      '/cloud/production-verification',
      '/execution/manager/readiness',
      '/release',
      '/cloud/runtime-integrity'
    ]) {
      expect(hub).toContain(route);
    }
  });

  it('does not duplicate release data or provider truth in the convergence hub', () => {
    expect(hub).not.toContain('fetch(');
    expect(hub).not.toContain('localStorage');
    expect(hub).toContain('Source merge, CI, provider deployment and production verification remain separate facts');
  });
});
